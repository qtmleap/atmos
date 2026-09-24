// Per-job live channel (docs/PLAN.md §1, docs/SPEC.md §11).
//
// One instance per job_id (`env.JOB_LIVE.idFromName(jobId)`). It holds the
// browsers' WebSockets through the Hibernation API and stores nothing: the
// data itself lives in D1 and clients load history through the REST API.
//
// - The Worker authenticates and checks visibility, then forwards the upgrade
//   request with `stub.fetch(request)` (see api/lib/live.ts `connectLive`).
// - Ingest routes call `notify(message)` / `notifyMany(messages)` over Workers
//   RPC (api/lib/live.ts `notifyLive` / `notifyLiveMany`), which broadcast to
//   every socket. A batch ingest sends its whole batch in one RPC so the
//   frames arrive in insertion order and cost a single subrequest.
// - A `status` message for a finished/failed job closes every socket with
//   code 1000 right after it is sent.
import { DurableObject } from 'cloudflare:workers'
import { LIVE_CLOSE_CODES, type LiveMessage } from '../../shared/types'

export interface NotifyResult {
  /** Sockets the message was written to. */
  delivered: number
}

export class JobLive extends DurableObject<CloudflareBindings> {
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected Upgrade: websocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1])
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  /** Broadcasts `message` as a JSON text frame to every connected socket. */
  async notify(message: LiveMessage): Promise<NotifyResult> {
    return this.notifyMany([message])
  }

  /**
   * Broadcasts each message, in order, as its own JSON text frame to every
   * connected socket. `delivered` counts the sockets that accepted every
   * frame. If any message is a `status` for a finished/failed job, the
   * sockets are closed with 1000 after the whole batch has been sent.
   */
  async notifyMany(messages: readonly LiveMessage[]): Promise<NotifyResult> {
    const frames = messages.map((message) => JSON.stringify(message))
    const sockets = this.ctx.getWebSockets()
    const delivered = sockets.filter((ws) => frames.every((frame) => sendQuietly(ws, frame))).length
    if (
      messages.some((message) => message.type === 'status' && message.data.status !== 'running')
    ) {
      for (const ws of sockets) {
        closeQuietly(ws, LIVE_CLOSE_CODES.normal, 'job ended')
      }
    }
    return { delivered }
  }

  /** Number of currently connected sockets. */
  async connectionCount(): Promise<number> {
    return this.ctx.getWebSockets().length
  }

  // Clients have no application messages (one-way push); ignore anything sent.
  override async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): Promise<void> {}

  override async webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // Complete the closing handshake. 1005/1006 are reserved and cannot be sent.
    closeQuietly(ws, code === 1005 || code === 1006 ? LIVE_CLOSE_CODES.normal : code, 'closed')
  }

  override async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    closeQuietly(ws, 1011, 'error')
  }
}

// A socket may already be closing (client left between getWebSockets() and
// send); one broken peer must not stop the broadcast to the others.
const sendQuietly = (ws: WebSocket, frame: string): boolean => {
  try {
    ws.send(frame)
    return true
  } catch {
    return false
  }
}

const closeQuietly = (ws: WebSocket, code: number, reason: string): void => {
  try {
    ws.close(code, reason)
  } catch {
    // Already closed.
  }
}
