// Request and response shapes shared by the fixture handlers, plus the few
// helpers every resource module needs (JSON, SPEC §0.3 errors, §0.4 pages).
// Kept apart from index.ts so the resource modules can import it without an
// import cycle through the routing table.
import type { ErrorCode, ErrorResponse, Page } from '../../src/shared/types'

/** Name of the state picked with `?scenario=` on a page navigation (see plugin.ts). */
export type Scenario = string | null

export interface FixtureRequest {
  method: string
  url: URL
  /** `:name` segments of the matched route pattern. */
  params: Readonly<Record<string, string>>
  scenario: Scenario
  /** Path of the page that issued the request (from Referer), or null. */
  pagePath: string | null
  /** The request body parsed as JSON; undefined when empty or not JSON. */
  json: () => Promise<unknown>
}

export interface FixtureResponse {
  status: number
  headers: Readonly<Record<string, string>>
  body: string | Uint8Array | null
}

export type FixtureHandler = (request: FixtureRequest) => FixtureResponse | Promise<FixtureResponse>

export const json = (value: unknown, status = 200): FixtureResponse => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(value),
})

export const noContent = (): FixtureResponse => ({ status: 204, headers: {}, body: null })

export const binary = (contentType: string, body: string | Uint8Array): FixtureResponse => ({
  status: 200,
  headers: { 'content-type': contentType, 'cache-control': 'no-store' },
  body,
})

export const apiError = (status: number, code: ErrorCode, message: string): FixtureResponse => {
  const response: ErrorResponse = { error: { code, message } }
  return json(response, status)
}

export const notFound = (what: string): FixtureResponse =>
  apiError(404, 'not_found', `${what} not found in the dev fixtures`)

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export const readLimit = (url: URL): number => {
  const raw = Number(url.searchParams.get('limit'))
  return Number.isInteger(raw) && raw > 0 ? Math.min(raw, MAX_LIMIT) : DEFAULT_LIMIT
}

const readOffset = (url: URL): number => {
  const raw = Number(url.searchParams.get('cursor'))
  return Number.isInteger(raw) && raw > 0 ? raw : 0
}

/**
 * One page of `rows` with an offset cursor. `firstPage` caps the first page at
 * the number of rows the mock shows, so the list opens exactly as drawn and
 * still reports a next page; later pages follow `limit`.
 */
export const paginate = <T>(rows: readonly T[], url: URL, firstPage?: number): Page<T> => {
  const offset = readOffset(url)
  const limit = readLimit(url)
  const size = offset === 0 && firstPage !== undefined ? Math.min(limit, firstPage) : limit
  const end = offset + size
  return {
    items: rows.slice(offset, end),
    next_cursor: end < rows.length ? String(end) : null,
  }
}

/** Serial-id cursor (`id > cursor`) as used by the metrics endpoint. */
export const afterSerial = <T extends { id: string }>(
  rows: readonly T[],
  cursor: string | null,
): T[] => (cursor === null ? [...rows] : rows.filter((row) => Number(row.id) > Number(cursor)))
