// In-process LiveHub (src/api/platform/types.ts) for the self-hosted server:
// the Bun equivalent of the per-job JobLive Durable Object
// (src/api/durable-objects/job-live.ts). One process instead of one DO per
// job, so the sockets for every job live in a single Map here rather than
// being scoped by the runtime; the wire protocol matches exactly:
//
//   - notify/notifyMany broadcast each message, in order, as a JSON text
//     frame; `delivered` counts the sockets every frame reached.
//   - A `status` message whose job is no longer `running` closes every
//     socket for that job with LIVE_CLOSE_CODES.normal right after the
//     batch has been sent.
//   - Sockets receive no application messages back (one-way push); the
//     `message` handler below ignores anything a client sends.
//
// Bun upgrades a request with `server.upgrade(request)`, called on the
// `Server` instance `Bun.serve()` returns — not on something reachable from
// inside `connect`'s call chain (getPlatform(c).live.connect(...), reached
// through Hono from src/api/routes/live.ts). So the hub is built in two
// steps: `createLiveHub()` here, before the server exists, and
// `hub.attach(server)` in src/server/index.ts right after `Bun.serve()`
// returns (before any request can reach `connect`, since nothing yields to
// the event loop in between). `hub.websocket` is Bun.serve's `websocket`
// option; `open`/`close` there keep the per-job socket sets in sync with
// which connections are actually alive.
import type { Server, ServerWebSocket, WebSocketHandler } from 'bun'
import type { LiveHub, NotifyResult } from '../api/platform/types'
import { LIVE_CLOSE_CODES, type LiveMessage } from '../shared/types'

interface SocketData {
  jobId: string
}

export interface InProcessLiveHub extends LiveHub {
  /** Pass as Bun.serve's `websocket` option. */
  readonly websocket: WebSocketHandler<SocketData>
  /** Call once, right after `Bun.serve()` returns, so `connect` can upgrade requests. */
  attach(server: Server<SocketData>): void
}

/** `ws.send` returns the bytes written, 0 when the message was dropped (Bun never throws here, unlike Cloudflare's hibernatable WebSocket). */
const sendQuietly = (ws: ServerWebSocket<SocketData>, frame: string): boolean => ws.send(frame) > 0

const closeQuietly = (ws: ServerWebSocket<SocketData>, code: number, reason: string): void => {
  try {
    ws.close(code, reason)
  } catch {
    // Already closed.
  }
}

export const createLiveHub = (): InProcessLiveHub => {
  const socketsByJob = new Map<string, Set<ServerWebSocket<SocketData>>>()
  const serverRef: { current: Server<SocketData> | null } = { current: null }

  const socketsFor = (jobId: string): Set<ServerWebSocket<SocketData>> => {
    const existing = socketsByJob.get(jobId)
    if (existing !== undefined) {
      return existing
    }
    const created = new Set<ServerWebSocket<SocketData>>()
    socketsByJob.set(jobId, created)
    return created
  }

  const notifyMany = async (
    jobId: string,
    messages: readonly LiveMessage[],
  ): Promise<NotifyResult> => {
    const frames = messages.map((message) => JSON.stringify(message))
    const peers = [...socketsFor(jobId)]
    const delivered = peers.filter((ws) => frames.every((frame) => sendQuietly(ws, frame))).length
    if (
      messages.some((message) => message.type === 'status' && message.data.status !== 'running')
    ) {
      for (const ws of peers) {
        closeQuietly(ws, LIVE_CLOSE_CODES.normal, 'job ended')
      }
    }
    return { delivered }
  }

  return {
    notify: (jobId, message) => notifyMany(jobId, [message]),
    notifyMany,
    connect: async (jobId, request) => {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected Upgrade: websocket', { status: 426 })
      }
      const server = serverRef.current
      if (server === null) {
        return new Response('live hub not attached to a server yet', { status: 503 })
      }
      const upgraded = server.upgrade(request, { data: { jobId } })
      if (!upgraded) {
        return new Response('websocket upgrade failed', { status: 400 })
      }
      // Bun already completes the 101 handshake once `upgrade` succeeds and
      // ignores whatever a fetch handler returns afterwards; this Response
      // only satisfies the LiveHub/Hono signature and is never sent.
      return new Response(null, { status: 101 })
    },
    attach: (server) => {
      serverRef.current = server
    },
    websocket: {
      open: (ws) => {
        socketsFor(ws.data.jobId).add(ws)
      },
      close: (ws) => {
        socketsFor(ws.data.jobId).delete(ws)
      },
      // Clients have no application messages (one-way push); ignore anything sent.
      message: () => {},
    },
  }
}
