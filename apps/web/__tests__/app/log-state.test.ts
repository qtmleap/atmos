import { describe, expect, test } from 'bun:test'
import {
  filterLogLines,
  initialLogState,
  logReducer,
  newestLogId,
  oldestLogId,
  summarizeFailure,
} from '../../src/app/lib/log-state'
import { compareSerialId, mergeBySerialId } from '../../src/app/lib/serial-id'
import { logLine } from './fixtures'

describe('serial ids', () => {
  test('compare numerically, not as text', () => {
    expect(compareSerialId('9', '10')).toBeLessThan(0)
    expect(compareSerialId('10', '10')).toBe(0)
    expect(compareSerialId('11', '10')).toBeGreaterThan(0)
  })

  test('merge drops duplicates and orders by id', () => {
    const merged = mergeBySerialId([logLine(10), logLine(2)], [logLine(9), logLine(10, 'again')])
    expect(merged.map((l) => l.id)).toEqual(['2', '9', '10'])
    expect(merged.at(-1)?.message).toBe('again')
  })
})

describe('logReducer', () => {
  test('orders an initial page by id whatever order it arrives in', () => {
    const state = logReducer(initialLogState(), {
      type: 'page',
      request: 'initial',
      page: { items: [logLine(3), logLine(2), logLine(1)], next_cursor: '1' },
    })
    expect(state.lines.map((l) => l.id)).toEqual(['1', '2', '3'])
    expect(state.hasOlder).toBe(true)
    expect(state.loading).toBeNull()
    expect(oldestLogId(state)).toBe('1')
    expect(newestLogId(state)).toBe('3')
  })

  test('older pages prepend and settle hasOlder, newer pages settle hasNewer', () => {
    const first = logReducer(initialLogState(), {
      type: 'page',
      request: 'initial',
      page: { items: [logLine(5), logLine(6)], next_cursor: '5' },
    })
    const older = logReducer(first, {
      type: 'page',
      request: 'older',
      page: { items: [logLine(4), logLine(3)], next_cursor: null },
    })
    expect(older.lines.map((l) => l.id)).toEqual(['3', '4', '5', '6'])
    expect(older.hasOlder).toBe(false)
    expect(older.hasNewer).toBe(true)
    const newer = logReducer(older, {
      type: 'page',
      request: 'newer',
      page: { items: [], next_cursor: null },
    })
    expect(newer.hasNewer).toBe(false)
  })

  test('live lines are merged without duplicates', () => {
    const first = logReducer(initialLogState(), {
      type: 'page',
      request: 'initial',
      page: { items: [logLine(1)], next_cursor: null },
    })
    const live = logReducer(first, { type: 'live', lines: [logLine(1), logLine(2)] })
    expect(live.lines.map((l) => l.id)).toEqual(['1', '2'])
  })

  test('a failure keeps the lines and records the message', () => {
    const first = logReducer(initialLogState(), { type: 'live', lines: [logLine(1)] })
    const failed = logReducer(first, { type: 'failure', message: 'boom' })
    expect(failed.lines.length).toBe(1)
    expect(failed.error).toBe('boom')
    expect(failed.loading).toBeNull()
  })

  test('filterLogLines keeps one stream', () => {
    const lines = [logLine(1), logLine(2, 'oops', 'stderr')]
    expect(filterLogLines(lines, 'stderr').map((l) => l.id)).toEqual(['2'])
    expect(filterLogLines(lines, 'all')).toBe(lines)
  })
})

describe('summarizeFailure', () => {
  test('names the exception, the last step and the stderr note', () => {
    const summary = summarizeFailure([
      logLine(1, '[train] epoch=156 step=48100 batch_size=32'),
      logLine(2, 'Traceback (most recent call last):', 'stderr'),
      logLine(3, 'torch.OutOfMemoryError: CUDA out of memory.', 'stderr'),
      logLine(4, 'GPU 0 has a total capacity of 23.69 GiB', 'stderr'),
      logLine(5, '[atmos] run finished: status=failed'),
    ])
    expect(summary.title).toBe('GPU メモリ不足で学習が終了しました')
    expect(summary.description).toBe(
      'ステップ 48,100 · torch.OutOfMemoryError · 終了直前の stderr を表示しています。',
    )
  })

  test('falls back to a generic title without an exception', () => {
    expect(summarizeFailure([logLine(1, 'bye')])).toEqual({
      title: '学習が失敗しました',
      description: '終了時点のログを表示しています。',
    })
    expect(summarizeFailure([logLine(1, 'ValueError: bad shape', 'stderr')]).title).toBe(
      'ValueError で学習が終了しました',
    )
  })
})
