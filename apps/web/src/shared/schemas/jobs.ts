// docs/SPEC.md §1 Job and §7 Jobs.
//
// POST /api/projects/:project_id/jobs                 createJobRequestSchema -> 201 jobSchema
// GET  /api/projects/:project_id/jobs                 listJobsQuerySchema -> pageSchema(jobSchema)
// GET  /api/projects/:project_id/jobs/:job_id         -> jobSchema
// POST /api/projects/:project_id/jobs/:job_id/finish  finishJobRequestSchema -> jobSchema
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
  config: jobConfigSchema.default({}),
})

export const listJobsQuerySchema = paginationQuerySchema.extend({
  status: jobStatusSchema.optional(),
})

export const finishJobRequestSchema = z.object({
  status: finishedJobStatusSchema,
})
