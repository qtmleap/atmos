// docs/SPEC.md §1 LogLine and §10 Logs.
//
// POST /api/projects/:project_id/jobs/:job_id/logs  ingestLogsRequestSchema -> 202 ingestAcceptedResponseSchema (see ./metrics)
// GET  /api/projects/:project_id/jobs/:job_id/logs  listLogsQuerySchema -> pageSchema(logLineSchema)
//
// GET pagination is not the shared PaginationQuery: it is a `before` / `after`
// cursor pair over the integer id, with the shared `limit` (see
// src/api/routes/logs.ts for the paging rules).
import { z } from 'zod'
import {
  cursorSchema,
  isoDateTimeSchema,
  limitSchema,
  logStreamSchema,
  serialIdSchema,
  uuidSchema,
} from './common'

export const logLineSchema = z.object({
  /** The DB key is an integer (docs/SCHEMA.md); on the wire it is its decimal string. */
  id: serialIdSchema,
  job_id: uuidSchema,
  stream: logStreamSchema,
  message: z.string().nonempty(),
  logged_at: isoDateTimeSchema,
})

export const ingestLogItemSchema = z.object({
  stream: logStreamSchema,
  message: z.string().nonempty(),
  /** Server receive time when omitted. Strict ISO 8601, unlike ./metrics. */
  logged_at: isoDateTimeSchema.optional(),
})

export const ingestLogsRequestSchema = z.object({
  /** Missing `logs` has always been read as an empty batch (202 `{ accepted: 0 }`). */
  logs: z.array(ingestLogItemSchema).default([]),
})

export const listLogsQuerySchema = z.object({
  /** Cursor: lines with an id before this one. */
  before: cursorSchema.optional(),
  /** Cursor: lines with an id after this one. */
  after: cursorSchema.optional(),
  limit: limitSchema,
})
