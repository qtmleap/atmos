// Identifiers and their encodings. Tables exposed through the API (users,
// projects, jobs, access_tokens, media_assets) use UUID v4 text keys; metrics
// and logs use integer autoincrement keys that are sent as decimal strings
// (docs/SCHEMA.md).
import dayjs from 'dayjs'
import { serialIdSchema, uuidSchema } from '../../shared/schemas'

export const newId = (): string => crypto.randomUUID()

// Defined with the other SPEC schemas (src/shared/schemas/common.ts); re-exported for callers here.
export { uuidSchema }

export const isUuid = (value: string): boolean => uuidSchema.safeParse(value).success

/** Integer primary key (metrics/logs) to its wire form. */
export const serialIdToString = (id: number): string => id.toString(10)

/** Wire form back to an integer primary key; null for anything but a positive decimal integer. */
export const parseSerialId = (value: string): number | null => {
  if (!serialIdSchema.safeParse(value).success) {
    return null
  }
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

// ---------------------------------------------------------------------------
// Timestamps. The DB keeps Unix seconds (Drizzle `mode: 'timestamp'` gives a
// Date); the wire format is ISO 8601 UTC (docs/SPEC.md §0.1).
// ---------------------------------------------------------------------------

/** Current time as a Date for inserting into a `mode: 'timestamp'` column. */
export const now = (): Date => dayjs().toDate()

export const toIsoString = (date: Date): string => dayjs(date).toISOString()

export const toIsoStringOrNull = (date: Date | null): string | null =>
  date === null ? null : toIsoString(date)

// ---------------------------------------------------------------------------
// base64url (RFC 4648 §5, no padding)
// ---------------------------------------------------------------------------

export const bytesToBase64Url = (bytes: Uint8Array): string =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/** null when `value` is not valid unpadded base64url. */
export const base64UrlToBytes = (value: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
    return null
  }
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

export const textToBase64Url = (text: string): string =>
  bytesToBase64Url(new TextEncoder().encode(text))

/** null when `value` is not base64url or does not decode to valid UTF-8. */
export const base64UrlToText = (value: string): string | null => {
  const bytes = base64UrlToBytes(value)
  if (bytes === null) {
    return null
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}
