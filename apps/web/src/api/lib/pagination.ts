// Cursor pagination in the docs/SPEC.md §0.4 shape (`Page<T>`).
//
// Two cursor kinds, matching the two primary key kinds in docs/SCHEMA.md:
//
// - Keyset cursor, for UUID tables (users, projects, jobs, media_assets).
//   UUID v4 keys carry no order, so pages are ordered by a timestamp column
//   with the id as tie-breaker. The cursor is an opaque base64url string that
//   encodes (timestamp seconds, id) of the last item on the page.
//
// - Serial cursor, for integer tables (metrics, logs). The cursor is simply
//   the decimal id of the last item, which is also what `LogLine.id` /
//   `Metric.id` look like on the wire, so `before` / `after` of the logs API
//   (§10) accept an item id directly.
//
// Usage (keyset, newest first):
//
//   const { limit, cursor } = parsePagination(c.req.query())
//   const rows = await db.select().from(projects)
//     .where(cursor === undefined ? undefined
//       : keysetCondition(projects.createdAt, projects.id, decodeKeysetCursor(cursor), 'desc'))
//     .orderBy(desc(projects.createdAt), desc(projects.id))
//     .limit(limit + 1)
//   return c.json(toPage(rows, limit, toProject, (r) => encodeKeysetCursor(r.createdAt, r.id)))
import dayjs from 'dayjs'
import { and, eq, gt, lt, or, type SQL } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { z } from 'zod'
import { limitSchema, paginationQuerySchema } from '../../shared/schemas'
import type { Page } from '../../shared/types'
import { badRequest, validate } from './errors'
import { base64UrlToText, parseSerialId, serialIdToString, textToBase64Url } from './ids'

export type SortDirection = 'asc' | 'desc'

// The query schemas live with the other SPEC schemas; re-exported so the
// pagination helpers stay a single import for routes.
export { limitSchema, paginationQuerySchema }

export type Pagination = z.output<typeof paginationQuerySchema>

/**
 * Parses `limit` / `cursor` from a query record (`c.req.query()`).
 * Throws a 400 `validation_error` ApiError on bad input. Extra keys are ignored,
 * so endpoint-specific filters can be parsed separately from the same record.
 */
export const parsePagination = (query: Record<string, string>): Pagination =>
  validate(paginationQuerySchema, query)

/**
 * Builds a page from rows fetched with `.limit(limit + 1)`. The extra row only
 * signals that a next page exists; it is not returned.
 */
export const toPage = <Row, Item>(
  rows: Row[],
  limit: number,
  toItem: (row: Row) => Item,
  cursorOf: (row: Row) => string,
): Page<Item> => {
  const pageRows = rows.slice(0, limit)
  const last = pageRows.at(-1)
  return {
    items: pageRows.map(toItem),
    next_cursor: rows.length > limit && last !== undefined ? cursorOf(last) : null,
  }
}

// ---------------------------------------------------------------------------
// Keyset cursor (UUID tables)
// ---------------------------------------------------------------------------

export interface KeysetCursor {
  /** Timestamp column value of the last item. */
  at: Date
  id: string
}

const keysetPayloadSchema = z.tuple([z.number().int().nonnegative(), z.uuid()])

export const encodeKeysetCursor = (at: Date, id: string): string =>
  textToBase64Url(JSON.stringify([dayjs(at).unix(), id]))

/** Throws a 400 `validation_error` ApiError for anything encodeKeysetCursor did not produce. */
export const decodeKeysetCursor = (cursor: string): KeysetCursor => {
  const json = base64UrlToText(cursor)
  const payload = json === null ? null : safeJsonParse(json)
  const result = keysetPayloadSchema.safeParse(payload)
  if (!result.success) {
    throw badRequest('invalid cursor')
  }
  const [seconds, id] = result.data
  return { at: dayjs.unix(seconds).toDate(), id }
}

/**
 * WHERE condition selecting the rows that come after `cursor` when ordering
 * by (`atColumn`, `idColumn`) in `direction` — pair it with
 * `.orderBy(desc(at), desc(id))` for 'desc' or `.orderBy(asc(at), asc(id))` for 'asc'.
 */
export const keysetCondition = (
  atColumn: AnySQLiteColumn,
  idColumn: AnySQLiteColumn,
  cursor: KeysetCursor,
  direction: SortDirection,
): SQL | undefined => {
  const beyond = direction === 'desc' ? lt : gt
  return or(beyond(atColumn, cursor.at), and(eq(atColumn, cursor.at), beyond(idColumn, cursor.id)))
}

// ---------------------------------------------------------------------------
// Serial cursor (metrics, logs)
// ---------------------------------------------------------------------------

export const encodeSerialCursor = (id: number): string => serialIdToString(id)

/** Throws a 400 `validation_error` ApiError unless `cursor` is a positive decimal integer. */
export const decodeSerialCursor = (cursor: string): number => {
  const id = parseSerialId(cursor)
  if (id === null) {
    throw badRequest('invalid cursor')
  }
  return id
}

/** WHERE condition for rows after `cursorId` when ordering by `idColumn` in `direction`. */
export const serialCondition = (
  idColumn: AnySQLiteColumn,
  cursorId: number,
  direction: SortDirection,
): SQL => (direction === 'desc' ? lt(idColumn, cursorId) : gt(idColumn, cursorId))

const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
