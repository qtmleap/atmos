// Tests for src/server/live-hub.ts: the in-process LiveHub that reproduces
// the JobLive Durable Object's wire semantics (src/api/durable-objects/job-live.ts)
// over a real `Bun.serve` on port 0.
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { Server } from 'bun'
import { createLiveHub, type InProcessLiveHub } from '../../src/server/live-hub'
import { LIVE_CLOSE_CODES, type LiveMessage } from '../../src/shared/types'

const JOB_ID = 'job-1'
const TIMEOUT = 20_000

const hub: { current: InProcessLiveHub | null } = { current: null }
const server: { current: Server | null } = { current: null }

const runningHub = (): InProcessLiveHub => {
  if (hub.current === null) {
    throw new Error('hub not started')
  }
  return hub.current
}

const baseUrl = (): string => {
  if (server.current === null) {
    throw new Error('server not started')
  }
  return `http://localhost:${server.current.port}`
}

beforeEach(() => {
  const created = createLiveHub()
  const started = Bun.serve({
    port: 0,
    fetch: (request) => created.connect(JOB_ID, request),
    websocket: created.websocket,
  })
  created.attach(started)
  hub.current = created
  server.current = started
})

afterEach(() => {
  server.current?.stop(true)
  hub.current = null
  server.current = null
})

/** Waits until `condition()` is true, polling instead of a fixed sleep. */
const waitUntilTrue = async (condition: () => boolean, remaining = 200): Promise<void> => {
  if (condition()) {
    return
  }
  if (remaining === 0) {
    throw new Error('condition never became true')
  }
  await Bun.sleep(10)
  return waitUntilTrue(condition, remaining - 1)
}

const openSocket = async (): Promise<{ ws: WebSocket; received: LiveMessage[] }> => {
  const ws = new WebSocket(`ws://localhost:${server.current?.port}/live`)
  const received: LiveMessage[] = []
  ws.addEventListener('message', (event) => {
    received.push(typeof event.data === 'string' ? JSON.parse(event.data) : null)
  })
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true })
    ws.addEventListener('error', () => reject(new Error('socket failed to open')), { once: true })
  })
  return { ws, received }
}

describe('connect', () => {
  test('rejects a non-Upgrade request with 426', async () => {
    const res = await fetch(baseUrl())
    expect(res.status).toBe(426)
  })

  test('returns 503 before the hub is attached to a server', async () => {
    const fresh = createLiveHub()
    const res = await fresh.connect(
      JOB_ID,
      new Request('http://localhost/live', { headers: { Upgrade: 'websocket' } }),
    )
    expect(res.status).toBe(503)
  })
})

describe('notify / notifyMany', () => {
  test(
    'delivers a message, as JSON, to a connected socket',
    async () => {
      const { received } = await openSocket()
      const message: LiveMessage = {
        type: 'status',
        data: { status: 'running', finished_at: null },
      }
      const result = await runningHub().notify(JOB_ID, message)
      expect(result.delivered).toBe(1)
      await waitUntilTrue(() => received.length === 1)
      expect(received[0]).toEqual(message)
    },
    TIMEOUT,
  )

  test(
    'notifyMany sends every message in order to every connected socket',
    async () => {
      const first = await openSocket()
      const second = await openSocket()
      const messages: LiveMessage[] = [
        { type: 'status', data: { status: 'running', finished_at: null } },
        {
          type: 'log',
          data: {
            id: '1',
            job_id: JOB_ID,
            stream: 'stdout',
            message: 'hi',
            logged_at: '2026-01-01T00:00:00.000Z',
          },
        },
      ]
      const result = await runningHub().notifyMany(JOB_ID, messages)
      expect(result.delivered).toBe(2)
      await waitUntilTrue(() => first.received.length === 2 && second.received.length === 2)
      expect(first.received).toEqual(messages)
      expect(second.received).toEqual(messages)
    },
    TIMEOUT,
  )

  test(
    'delivered counts only sockets currently connected',
    async () => {
      const result = await runningHub().notify(JOB_ID, {
        type: 'status',
        data: { status: 'running', finished_at: null },
      })
      expect(result.delivered).toBe(0)
    },
    TIMEOUT,
  )

  test(
    'a status message for a job that is no longer running closes every socket with LIVE_CLOSE_CODES.normal',
    async () => {
      const { ws } = await openSocket()
      const closed = new Promise<{ code: number }>((resolve) => {
        ws.addEventListener('close', (event) => resolve({ code: event.code }), { once: true })
      })
      await runningHub().notify(JOB_ID, {
        type: 'status',
        data: { status: 'finished', finished_at: '2026-01-01T00:00:00.000Z' },
      })
      const event = await closed
      expect(event.code).toBe(LIVE_CLOSE_CODES.normal)
    },
    TIMEOUT,
  )

  test(
    'a running status message does not close the socket',
    async () => {
      const { ws, received } = await openSocket()
      await runningHub().notify(JOB_ID, {
        type: 'status',
        data: { status: 'running', finished_at: null },
      })
      await waitUntilTrue(() => received.length === 1)
      expect(ws.readyState).toBe(WebSocket.OPEN)
    },
    TIMEOUT,
  )
})
