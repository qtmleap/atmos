// Metrics endpoints (docs/SPEC.md §8).
import dayjs from 'dayjs'
import { and, asc, eq, gte } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  type Db,
  type JobRow,
  jobs,
  type MetricRow,
  metrics,
  type ProjectRow,
  projects,
} from '#schema'
import { ingestMetricsRequestSchema, listMetricsQuerySchema } from '../../shared/schemas'
import { INGEST_METRICS_MAX_ITEMS, type Metric } from '../../shared/types'
import {
  assertCanViewProject,
  canWriteProject,
  requireBearerUser,
  resolveViewer,
} from '../lib/auth'
import { notFound, payloadTooLarge, readJson, validate } from '../lib/errors'
import { now, serialIdToString, toIsoString } from '../lib/ids'
import { notifyLiveMany } from '../lib/live'
import { decodeSerialCursor, encodeSerialCursor, serialCondition, toPage } from '../lib/pagination'
import { type AppEnv, getPlatform } from '../platform/context'

export const metricsRoutes = new Hono<AppEnv>()

/**
 * D1 allows at most 100 bound parameters per SQL statement. Each metric row
 * binds 5 (job_id, step, key, value, logged_at; `id` is emitted as a literal
 * `null` for AUTOINCREMENT), so a single INSERT fails above 20 rows. Rows are
 * split into chunks of this size and sent together with `platform.batch`,
 * which is one round trip and runs as a single transaction.
 */
const METRICS_INSERT_CHUNK_ROWS = 16

const chunk = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  )

const toMetric = (row: MetricRow): Metric => ({
  id: serialIdToString(row.id),
  job_id: row.jobId,
  step: row.step,
  key: row.key,
  value: row.value,
  logged_at: toIsoString(row.loggedAt),
})

/** project_id/job_id mismatches are reported as a job 404 (docs/SPEC.md §7/§8). */
const findScopedProjectAndJob = async (
  db: Db,
  projectId: string,
  jobId: string,
): Promise<{ project: ProjectRow; job: JobRow }> => {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
  if (project === undefined) {
    throw notFound('project not found')
  }
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.projectId, project.id)),
  })
  if (job === undefined) {
    throw notFound('job not found')
  }
  return { project, job }
}

// POST /api/projects/:project_id/jobs/:job_id/metrics — Bearer token, batch insert.
metricsRoutes.post('/:project_id/jobs/:job_id/metrics', async (c) => {
  const user = await requireBearerUser(getPlatform(c), c.req.raw)
  const db = getPlatform(c).db
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, c.req.param('project_id')),
  })
  if (project === undefined || !canWriteProject(project, user)) {
    throw notFound('project not found')
  }
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, c.req.param('job_id')), eq(jobs.projectId, project.id)),
  })
  if (job === undefined) {
    throw notFound('job not found')
  }
  const body = await readJson(c.req.raw, ingestMetricsRequestSchema)
  if (body.metrics.length > INGEST_METRICS_MAX_ITEMS) {
    throw payloadTooLarge(`metrics must not exceed ${INGEST_METRICS_MAX_ITEMS} items per request`)
  }
  const receivedAt = now()
  const values = body.metrics.map((item) => ({
    jobId: job.id,
    step: item.step,
    key: item.key,
    value: item.value,
    loggedAt: item.logged_at === undefined ? receivedAt : dayjs(item.logged_at).toDate(),
  }))
  const platform = getPlatform(c)
  const inserted = (
    await platform.batch((tx) =>
      chunk(values, METRICS_INSERT_CHUNK_ROWS).map((rows) =>
        tx.insert(metrics).values(rows).returning(),
      ),
    )
  ).flat()
  platform.waitUntil(
    notifyLiveMany(
      platform.live,
      job.id,
      inserted.map((row) => ({ type: 'metric', data: toMetric(row) })),
    ),
  )
  return c.json({ accepted: values.length }, 202)
})

// GET /api/projects/:project_id/jobs/:job_id/metrics
metricsRoutes.get('/:project_id/jobs/:job_id/metrics', async (c) => {
  const db = getPlatform(c).db
  const { project, job } = await findScopedProjectAndJob(
    db,
    c.req.param('project_id'),
    c.req.param('job_id'),
  )
  const viewer = await resolveViewer(getPlatform(c), c.req.raw)
  assertCanViewProject(project, viewer)
  const query = validate(listMetricsQuerySchema, c.req.query())
  const cursorCondition =
    query.cursor === undefined
      ? undefined
      : serialCondition(metrics.id, decodeSerialCursor(query.cursor), 'asc')
  const rows = await db
    .select()
    .from(metrics)
    .where(
      and(
        eq(metrics.jobId, job.id),
        query.key === undefined ? undefined : eq(metrics.key, query.key),
        query.since_step === undefined ? undefined : gte(metrics.step, query.since_step),
        cursorCondition,
      ),
    )
    .orderBy(asc(metrics.id))
    .limit(query.limit + 1)
  return c.json(toPage(rows, query.limit, toMetric, (row) => encodeSerialCursor(row.id)))
})
