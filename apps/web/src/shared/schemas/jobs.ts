// docs/SPEC.md §1 Job and §7 Jobs.
//
// POST   /api/projects/:project_id/jobs                 createJobRequestSchema -> 200 jobSchema (resumed) | 201 jobSchema (created)
// GET    /api/projects/:project_id/jobs                 listJobsQuerySchema -> pageSchema(jobSchema)
// GET    /api/projects/:project_id/jobs/:job_id         -> jobSchema
// PATCH  /api/projects/:project_id/jobs/:job_id         updateJobRequestSchema -> jobSchema
// DELETE /api/projects/:project_id/jobs/:job_id         -> 204
// POST   /api/projects/:project_id/jobs/:job_id/finish  finishJobRequestSchema -> jobSchema
import { z } from 'zod'
import {
  finishedJobStatusSchema,
  isoDateTimeSchema,
  jobStatusSchema,
  paginationQuerySchema,
  uuidSchema,
} from './common'

/** `Job.config`: arbitrary JSON object keyed by non-empty strings. */
const jobConfigSchema = z.record(z.string().nonempty(), z.unknown())

export const jobSchema = z.object({
  id: uuidSchema,
  project_id: uuidSchema,
  name: z.string().nonempty().nullable(),
  status: jobStatusSchema,
  config: jobConfigSchema,
  /** User.id of the token owner that created the job. */
  created_by: uuidSchema,
  started_at: isoDateTimeSchema,
  finished_at: isoDateTimeSchema.nullable(),
  /** Highest metric step logged so far. Shown in lists; the API does not send it yet. */
  last_step: z.number().int().optional(),
})

export const createJobRequestSchema = z.object({
  name: z.string().nonempty().optional(),
  /** Omitted means "unchanged" on resume, and defaults to `{}` on a fresh create (src/api/routes/jobs.ts). */
  config: jobConfigSchema.optional(),
  /** Present to resume: same project + same id reopens that job instead of creating a new one. */
  id: uuidSchema.optional(),
})

export const listJobsQuerySchema = paginationQuerySchema.extend({
  status: jobStatusSchema.optional(),
})

export const finishJobRequestSchema = z.object({
  status: finishedJobStatusSchema,
})

/** Same `name` rule as create; `null` clears it (create's `name` is only absent, never null). */
export const updateJobRequestSchema = z.object({
  name: z.string().nonempty().nullable(),
})
