// docs/SPEC.md §1 Metric and §8 Metrics.
//
// POST /api/projects/:project_id/jobs/:job_id/metrics  ingestMetricsRequestSchema -> 202 ingestAcceptedResponseSchema
// GET  /api/projects/:project_id/jobs/:job_id/metrics  listMetricsQuerySchema -> pageSchema(metricSchema)
//
// The 1000-item cap (INGEST_METRICS_MAX_ITEMS) is enforced by the handler as
// 413 `payload_too_large`, not by the schema, which would report it as 400.
import dayjs from 'dayjs'
import { z } from 'zod'
import { isoDateTimeSchema, paginationQuerySchema, serialIdSchema, uuidSchema } from './common'

export const metricSchema = z.object({
  /** The DB key is an integer (docs/SCHEMA.md); on the wire it is its decimal string. */
  id: serialIdSchema,
  job_id: uuidSchema,
  step: z.number().int(),
  key: z.string().nonempty(),
  value: z.number(),
  logged_at: isoDateTimeSchema,
})

/**
 * `logged_at` on ingest accepts anything dayjs can parse (looser than the
 * strict ISO 8601 of responses). Kept as the metrics endpoint has always
 * behaved; ./logs uses the strict form.
 */
const metricLoggedAtSchema = z
  .string()
  .nonempty()
  .refine((value) => dayjs(value).isValid(), { message: 'invalid ISO 8601 datetime' })

export const ingestMetricItemSchema = z.object({
  step: z.number().int(),
  key: z.string().nonempty(),
  value: z.number(),
  /** Server receive time when omitted. */
  logged_at: metricLoggedAtSchema.optional(),
})

export const ingestMetricsRequestSchema = z.object({
  metrics: z.array(ingestMetricItemSchema),
})

/** 202 body of both ingest endpoints (§8 and §10). */
export const ingestAcceptedResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
})

export const listMetricsQuerySchema = paginationQuerySchema.extend({
  /** Only this metric name. */
  key: z.string().nonempty().optional(),
  since_step: z.coerce.number<number>().int().optional(),
})
