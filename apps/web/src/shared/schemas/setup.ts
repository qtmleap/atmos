// docs/SPEC.md §2 Setup — POST /api/setup: setupRequestSchema -> setupResponseSchema.
import { z } from 'zod'
import { handleSchema, userWithEmailSchema } from './users'

export const setupRequestSchema = z.object({
  init_admin_key: z.string().nonempty(),
  handle: handleSchema,
  display_name: z.string().nonempty(),
})

export const setupResponseSchema = z.object({
  user: userWithEmailSchema,
})
