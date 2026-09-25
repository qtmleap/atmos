// docs/SPEC.md §1 MediaAsset and §9 Media.
//
// POST /api/projects/:project_id/jobs/:job_id/media            multipart (uploadMediaFieldsSchema + `file`) -> 201 mediaAssetSchema
// GET  /api/projects/:project_id/jobs/:job_id/media            listMediaQuerySchema -> pageSchema(mediaAssetSchema)
// GET  /api/projects/:project_id/jobs/:job_id/media/:media_id  -> binary
//
// The file itself (content type per kind, 2048KB cap) is checked by the handler
// against MEDIA_CONTENT_TYPES / MEDIA_MAX_BYTES in ../types.ts.
import { z } from 'zod'
import { isoDateTimeSchema, mediaKindSchema, paginationQuerySchema, uuidSchema } from './common'

export const mediaAssetSchema = z.object({
  id: uuidSchema,
  job_id: uuidSchema,
  step: z.number().int(),
  kind: mediaKindSchema,
  label: z.string().nonempty(),
  content_type: z.string().nonempty(),
  /** Bytes. */
  size: z.number().int().nonnegative(),
  /** `GET /api/projects/:project_id/jobs/:job_id/media/:media_id` */
  url: z.string().startsWith('/api/projects/'),
  logged_at: isoDateTimeSchema,
})

/** Text fields of the multipart upload; the binary goes in the `file` field. */
export const uploadMediaFieldsSchema = z.object({
  kind: mediaKindSchema,
  /** Multipart fields are strings, hence the coercion. */
  step: z.coerce.number<number>().int(),
  label: z.string().nonempty(),
})

export const listMediaQuerySchema = paginationQuerySchema.extend({
  kind: mediaKindSchema.optional(),
})
