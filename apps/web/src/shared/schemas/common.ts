// Zod schemas shared by every endpoint (docs/SPEC.md §0 and the enumerations
// of §1). The enum tables themselves live in ../types.ts (type-only file plus
// `as const` tables); this module turns them into runtime validators.
//
// Request schemas are what the Worker validates with (`validate` / `readJson`
// in src/api/lib/errors.ts). Response schemas describe the wire shape for
// tests and for deriving the types in ../types.ts; handlers do not parse
// their own output.
import { z } from 'zod'
import {
  ERROR_CODES,
  FINISHED_JOB_STATUSES,
  JOB_STATUSES,
  LOG_STREAMS,
  MEDIA_KINDS,
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  ROLES,
  VISIBILITIES,
} from '../types'

// ---------------------------------------------------------------------------
// Enumerations (§1, docs/SCHEMA.md)
// ---------------------------------------------------------------------------

export const roleSchema = z.enum(ROLES)
export const visibilitySchema = z.enum(VISIBILITIES)
export const jobStatusSchema = z.enum(JOB_STATUSES)
/** Statuses a job can be finished with (`POST .../finish`). */
export const finishedJobStatusSchema = z.enum(FINISHED_JOB_STATUSES)
export const mediaKindSchema = z.enum(MEDIA_KINDS)
export const logStreamSchema = z.enum(LOG_STREAMS)
export const errorCodeSchema = z.enum(ERROR_CODES)

// ---------------------------------------------------------------------------
// §0.1 Formats
// ---------------------------------------------------------------------------

/** UUID v4 text keys (users, projects, jobs, access_tokens, media_assets). */
export const uuidSchema = z.uuid()

/**
 * Wire form of an integer autoincrement key (metrics, logs): a positive
 * decimal integer with no sign, no leading zero and at most 16 digits, so it
 * always converts back to a safe integer.
 */
export const serialIdSchema = z.string().regex(/^[1-9][0-9]{0,15}$/, 'expected a decimal id')

/** ISO 8601 UTC timestamp as the API emits it (e.g. `2026-09-24T12:00:00.000Z`). */
export const isoDateTimeSchema = z.iso.datetime()

// ---------------------------------------------------------------------------
// §0.3 Error response
// ---------------------------------------------------------------------------

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().nonempty(),
  }),
})

// ---------------------------------------------------------------------------
// §0.4 Pagination
// ---------------------------------------------------------------------------

/**
 * `limit` query parameter: default 20, 1..100. Query values arrive as strings,
 * hence the coercion; the `<number>` keeps the declared input type numeric.
 */
export const limitSchema = z.coerce
  .number<number>()
  .int()
  .min(1)
  .max(PAGINATION_MAX_LIMIT)
  .default(PAGINATION_DEFAULT_LIMIT)

/** Opaque cursor: `next_cursor` of the previous page, passed back verbatim. */
export const cursorSchema = z.string().nonempty()

export const paginationQuerySchema = z.object({
  limit: limitSchema,
  cursor: cursorSchema.optional(),
})

/** `Page<T>`: builds the page schema for one item schema. */
export const pageSchema = <Item extends z.ZodType>(item: Item) =>
  z.object({
    items: z.array(item),
    /** null when there is no next page. */
    next_cursor: cursorSchema.nullable(),
  })
