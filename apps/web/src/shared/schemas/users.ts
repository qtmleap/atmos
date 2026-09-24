// docs/SPEC.md §1 User / UserWithEmail and §4 Users.
//
// §4 has no request bodies; its list endpoints take `paginationQuerySchema`
// and its responses are `userSchema`, `pageSchema(userSchema)`,
// `pageSchema(projectSchema)` (see ./projects) and `userWithEmailSchema` (/me).
import { z } from 'zod'
import { HANDLE_PATTERN } from '../types'
import { isoDateTimeSchema, roleSchema, uuidSchema } from './common'

/** Handle format: ASCII letters, digits, `-` and `_`, 3 to 32 characters. */
export const handleSchema = z
  .string()
  .nonempty()
  .regex(HANDLE_PATTERN, 'handle must be 3-32 ASCII letters, digits, - or _')

export const userSchema = z.object({
  /** Internal UUID, never used in URLs. */
  id: uuidSchema,
  /** Unique URL id (`/users/:handle`). */
  handle: handleSchema,
  display_name: z.string().nonempty(),
  /** null when avatar_key is unset, otherwise `/api/users/:handle/avatar`. */
  avatar_url: z.string().nonempty().nullable(),
  role: roleSchema,
  created_at: isoDateTimeSchema,
})

/** Only returned to admins and to the user themself. */
export const userWithEmailSchema = userSchema.extend({
  cf_access_email: z.email(),
})
