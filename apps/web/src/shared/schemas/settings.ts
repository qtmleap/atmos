// docs/SPEC.md §1 AccessToken / AccessTokenCreated / AccessTokenStatus and §5
// Settings.
//
// PATCH  /api/settings/profile  updateProfileRequestSchema -> userWithEmailSchema (see ./users)
// PUT    /api/settings/avatar   multipart `file` -> updateAvatarResponseSchema
// GET    /api/settings/tokens   -> accessTokenStatusSchema
// POST   /api/settings/tokens   -> 201 accessTokenCreatedSchema
// DELETE /api/settings/tokens   -> 204
//
// The avatar file (AVATAR_CONTENT_TYPES, AVATAR_MAX_BYTES in ../types.ts) is
// checked by the handler; there is no JSON body to validate.
import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './common'
import { handleSchema } from './users'

export const updateProfileRequestSchema = z.object({
  handle: handleSchema.optional(),
  display_name: z.string().nonempty().optional(),
})

export const updateAvatarResponseSchema = z.object({
  avatar_url: z.string().startsWith('/api/users/'),
})

export const accessTokenSchema = z.object({
  id: uuidSchema,
  issued_at: isoDateTimeSchema,
  revoked_at: isoDateTimeSchema.nullable(),
  /** The prefix and last 4 characters (`atmos_...w52G`); null for tokens issued before hints were stored. */
  hint: z.string().nonempty().nullable(),
})

/** Only the response right after issuing carries the plaintext token. */
export const accessTokenCreatedSchema = accessTokenSchema.extend({
  token: z.string().nonempty(),
})

/** `GET /api/settings/tokens`: the caller's current token, never the hash or plaintext. */
export const accessTokenStatusSchema = z.object({
  active: accessTokenSchema.nullable(),
})
