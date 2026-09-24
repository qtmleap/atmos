// docs/SPEC.md §1 Project and §6 Projects.
//
// GET  /api/projects              paginationQuerySchema -> pageSchema(projectSchema)
// GET  /api/projects/:project_id  -> projectSchema
// POST /api/projects              createProjectRequestSchema -> 200 | 201 projectSchema
import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema, visibilitySchema } from './common'
import { handleSchema } from './users'

export const projectOwnerSchema = z.object({
  id: uuidSchema,
  handle: handleSchema,
  display_name: z.string().nonempty(),
})

export const projectSchema = z.object({
  id: uuidSchema,
  name: z.string().nonempty(),
  visibility: visibilitySchema,
  owner: projectOwnerSchema,
  created_at: isoDateTimeSchema,
  /** Number of jobs in the project. Shown in lists; the API does not send it yet. */
  job_count: z.number().int().nonnegative().optional(),
  /** When the newest job was created or finished. Shown in lists; the API does not send it yet. */
  updated_at: isoDateTimeSchema.optional(),
})

export const createProjectRequestSchema = z.object({
  name: z.string().nonempty(),
  /** Defaults to "private". */
  visibility: visibilitySchema.default('private'),
})
