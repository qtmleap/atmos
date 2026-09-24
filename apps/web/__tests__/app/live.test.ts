import { describe, expect, test } from 'bun:test'
import { liveUrl, parseLiveMessage, reconnectDelay, shouldReconnect } from '../../src/app/lib/live'
import type { LiveMessage } from '../../src/shared/types'
import { logLine, media, metric } from './fixtures'

describe('parseLiveMessage', () => {
  test('accepts every SPEC message type', () => {
    const frames: LiveMessage[] = [
      { type: 'metric', data: metric(1, 'loss', 1, 0.5) },
      { type: 'log', data: logLine(1) },
      { type: 'media', data: media('m1', 'sample', 1) },
      { type: 'status', data: { status: 'finished', finished_at: '2026-09-24T00:00:00.000Z' } },
    ]
    for (const frame of frames) {
      expect(parseLiveMessage(JSON.stringify(frame))).toEqual(frame)
    }
  })

  test('rejects broken JSON, unknown types and malformed data', () => {
    expect(parseLiveMessage('{')).toBeNull()
    expect(parseLiveMessage(JSON.stringify({ type: 'hello', data: {} }))).toBeNull()
    expect(
      parseLiveMessage(
        JSON.stringify({ type: 'metric', data: { ...metric(1, 'x', 1, 1), value: '1' } }),
      ),
    ).toBeNull()
    expect(
      parseLiveMessage(
        JSON.stringify({ type: 'status', data: { status: 'paused', finished_at: null } }),
      ),
    ).toBeNull()
  })
})

describe('liveUrl', () => {
  test('follows the page scheme', () => {
    expect(liveUrl({ protocol: 'https:', host: 'atmos.example' }, 'p', 'j')).toBe(
      'wss://atmos.example/api/projects/p/jobs/j/live',
    )
    expect(liveUrl({ protocol: 'http:', host: 'localhost:8787' }, 'p', 'j')).toBe(
      'ws://localhost:8787/api/projects/p/jobs/j/live',
    )
  })
})

describe('reconnect policy', () => {
  test('does not retry a normal close, 4403 or 4404', () => {
    expect(shouldReconnect(1000)).toBe(false)
    expect(shouldReconnect(4403)).toBe(false)
    expect(shouldReconnect(4404)).toBe(false)
    expect(shouldReconnect(1006)).toBe(true)
    expect(shouldReconnect(1011)).toBe(true)
  })

  test('backs off exponentially up to 30 seconds', () => {
    expect([0, 1, 2, 3].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000])
    expect(reconnectDelay(10)).toBe(30_000)
  })
})
