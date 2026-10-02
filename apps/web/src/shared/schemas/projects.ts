// docs/SPEC.md §1 Project and §6 Projects.
//
// GET    /api/projects              paginationQuerySchema -> pageSchema(projectSchema)
// GET    /api/projects/:project_id  -> projectSchema
// POST   /api/projects              createProjectRequestSchema -> 200 | 201 projectSchema
// PATCH  /api/projects/:project_id  updateProjectRequestSchema -> projectSchema
// DELETE /api/projects/:project_id  -> 204
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
  /** Number of jobs in the project. */
  job_count: z.number().int().nonnegative().optional(),
  /** Latest job start, finish, or activity; the project creation time when there are no jobs. */
  updated_at: isoDateTimeSchema.optional(),
})

export const createProjectRequestSchema = z.object({
  name: z.string().nonempty(),
  /** Defaults to "private". */
  visibility: visibilitySchema.default('private'),
})

/** At least one of `name` / `visibility` is required; the same `name` rule as create. */
export const updateProjectRequestSchema = z
  .object({
    name: z.string().nonempty().optional(),
    visibility: visibilitySchema.optional(),
  })
  .refine((body) => body.name !== undefined || body.visibility !== undefined, {
    message: 'at least one of name or visibility is required',
  })
