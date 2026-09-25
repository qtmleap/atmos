// docs/SPEC.md §3 Admin.
//
// GET   /api/admin/users           paginationQuerySchema -> pageSchema(userWithEmailSchema)
// POST  /api/admin/users           adminCreateUserRequestSchema -> 201 userWithEmailSchema
// PATCH /api/admin/users/:user_id  adminUpdateUserRequestSchema -> userWithEmailSchema
import { z } from 'zod'
import { roleSchema } from './common'
import { handleSchema } from './users'

export const adminCreateUserRequestSchema = z.object({
  cf_access_email: z.email(),
  handle: handleSchema,
  display_name: z.string().nonempty(),
  role: roleSchema,
})

export const adminUpdateUserRequestSchema = z.object({
  role: roleSchema.optional(),
})
