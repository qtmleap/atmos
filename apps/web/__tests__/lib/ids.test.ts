import { describe, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import {
  base64UrlToBytes,
  base64UrlToText,
  bytesToBase64Url,
  isUuid,
  newId,
  parseSerialId,
  serialIdToString,
  textToBase64Url,
  toIsoString,
  toIsoStringOrNull,
  uuidSchema,
} from '../../src/api/lib/ids'
import * as shared from '../../src/shared/schemas'

describe('ids', () => {
  test('newId is a UUID v4', () => {
    const id = newId()
    expect(isUuid(id)).toBe(true)
    expect(id[14]).toBe('4')
    expect(newId()).not.toBe(id)
  })

  test('uuidSchema is the shared SPEC schema, re-exported', () => {
    expect(uuidSchema).toBe(shared.uuidSchema)
  })

  test('isUuid rejects non-UUIDs', () => {
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('')).toBe(false)
  })

  test('serial ids round-trip and reject anything else', () => {
    expect(serialIdToString(42)).toBe('42')
    expect(parseSerialId('42')).toBe(42)
    for (const bad of ['0', '-1', '01', '1.5', '1e3', ' 1', 'abc', '', '99999999999999999']) {
      expect(parseSerialId(bad)).toBeNull()
    }
  })

  test('timestamps are ISO 8601 UTC', () => {
    const date = dayjs('2026-09-24T12:00:00.000Z').toDate()
    expect(toIsoString(date)).toBe('2026-09-24T12:00:00.000Z')
    expect(toIsoStringOrNull(null)).toBeNull()
  })
})

describe('base64url', () => {
  test('round-trips bytes without padding or +/', () => {
    const bytes = Uint8Array.from([0xfb, 0xff, 0xfe, 0x00, 0x01])
    const encoded = bytesToBase64Url(bytes)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(base64UrlToBytes(encoded)).toEqual(bytes)
  })

  test('round-trips UTF-8 text', () => {
    expect(base64UrlToText(textToBase64Url('実験 1'))).toBe('実験 1')
  })

  test('rejects malformed input', () => {
    expect(base64UrlToBytes('a+b/')).toBeNull()
    expect(base64UrlToBytes('abcde')).toBeNull()
    expect(base64UrlToText(bytesToBase64Url(Uint8Array.from([0xff, 0xfe])))).toBeNull()
  })
})
