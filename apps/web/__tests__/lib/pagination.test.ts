import { describe, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import { ApiError } from '../../src/api/lib/errors'
import { newId } from '../../src/api/lib/ids'
import {
  decodeKeysetCursor,
  decodeSerialCursor,
  encodeKeysetCursor,
  encodeSerialCursor,
  limitSchema,
  paginationQuerySchema,
  parsePagination,
  toPage,
} from '../../src/api/lib/pagination'
import * as shared from '../../src/shared/schemas'

const expectValidationError = (run: () => unknown): void => {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    if (error instanceof ApiError) {
      expect(error.status).toBe(400)
      expect(error.code).toBe('validation_error')
    }
    return
  }
  throw new Error('expected a validation error')
}

describe('parsePagination', () => {
  test('uses the shared SPEC §0.4 schemas, re-exported', () => {
    expect(limitSchema).toBe(shared.limitSchema)
    expect(paginationQuerySchema).toBe(shared.paginationQuerySchema)
  })

  test('defaults limit to 20', () => {
    expect(parsePagination({})).toEqual({ limit: 20 })
  })

  test('coerces limit and passes the cursor through', () => {
    expect(parsePagination({ limit: '100', cursor: 'abc', status: 'running' })).toEqual({
      limit: 100,
      cursor: 'abc',
    })
  })

  test('rejects out of range or non-integer limits and empty cursors', () => {
    const queries: Record<string, string>[] = [
      { limit: '0' },
      { limit: '101' },
      { limit: '1.5' },
      { limit: 'x' },
      { cursor: '' },
    ]
    for (const query of queries) {
      expectValidationError(() => parsePagination(query))
    }
  })
})

describe('toPage', () => {
  test('returns next_cursor only when the extra row exists', () => {
    const rows = [1, 2, 3]
    expect(
      toPage(
        rows,
        2,
        (n) => n * 10,
        (n) => `c${n}`,
      ),
    ).toEqual({
      items: [10, 20],
      next_cursor: 'c2',
    })
    expect(
      toPage(
        rows,
        3,
        (n) => n,
        (n) => `c${n}`,
      ),
    ).toEqual({
      items: [1, 2, 3],
      next_cursor: null,
    })
    expect(
      toPage(
        [],
        3,
        (n: number) => n,
        (n) => `c${n}`,
      ),
    ).toEqual({ items: [], next_cursor: null })
  })
})

describe('keyset cursor', () => {
  test('round-trips (timestamp seconds, uuid)', () => {
    const id = newId()
    const at = dayjs('2026-09-24T12:34:56Z').toDate()
    const cursor = encodeKeysetCursor(at, id)
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/)
    const decoded = decodeKeysetCursor(cursor)
    expect(decoded.id).toBe(id)
    expect(dayjs(decoded.at).toISOString()).toBe('2026-09-24T12:34:56.000Z')
  })

  test('rejects tampered cursors', () => {
    for (const cursor of ['garbage!', 'e30', btoa('[1,"not-a-uuid"]'), encodeSerialCursor(5)]) {
      expectValidationError(() => decodeKeysetCursor(cursor))
    }
  })
})

describe('serial cursor', () => {
  test('is the decimal id', () => {
    expect(encodeSerialCursor(17)).toBe('17')
    expect(decodeSerialCursor('17')).toBe(17)
  })

  test('rejects non-ids', () => {
    for (const cursor of ['0', '-3', 'abc', '1.2']) {
      expectValidationError(() => decodeSerialCursor(cursor))
    }
  })
})
