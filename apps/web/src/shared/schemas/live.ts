// docs/SPEC.md §11 Live (WebSocket) — the JSON text frames the server pushes.
// Not an HTTP request/response pair; it lives here so `LiveMessage` in
// ../types.ts derives from the same item schemas as the REST responses.
import { z } from 'zod'
import { isoDateTimeSchema, jobStatusSchema } from './common'
import { logLineSchema } from './logs'
import { mediaAssetSchema } from './media'
import { metricSchema } from './metrics'

export const liveStatusDataSchema = z.object({
  status: jobStatusSchema,
  finished_at: isoDateTimeSchema.nullable(),
})

export const liveMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('metric'), data: metricSchema }),
  z.object({ type: z.literal('log'), data: logLineSchema }),
  z.object({ type: z.literal('media'), data: mediaAssetSchema }),
  z.object({ type: z.literal('status'), data: liveStatusDataSchema }),
])
