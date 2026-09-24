// docs/SPEC.md §10 Logs: batch-ingest and windowed read of stdout/stderr lines.
//
// Mounted at /api/projects/:project_id/jobs/:job_id/logs (integration step,
// docs/PLAN.md §8 / src/api/app.ts). Handlers read `project_id` / `job_id`
// from that mount prefix via `c.req.param()`.
//
// GET pagination is not the shared PaginationQuery (docs/SPEC.md §0.4): it is
// a `before` / `after` cursor pair over the integer id (docs/SCHEMA.md). Both
// directions return items oldest-first (ascending id) so pages can be
// concatenated for display:
//   - `after`  — forward/"load newer": id > cursor, ascending; next_cursor
//     continues forward.
//   - no cursor or `before` — "tail": the most recent `limit` lines (id <
//     cursor when `before` is given), fetched newest-first and reversed for
//     the response; next_cursor is the oldest id in the page, for loading
//     further back.

import dayjs from 'dayjs'
import { and, asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  createDb,
  type Db,
  type JobRow,
  jobs,
  type LogRow,
  logs,
  type ProjectRow,
  projects,
} from '../../db/schema'
import { ingestLogsRequestSchema, listLogsQuerySchema } from '../../shared/schemas'
import type { LogLine, Page } from '../../shared/types'
import {
  assertCanViewProject,
  canWriteProject,
  requireBearerUser,
  resolveViewer,
} from '../lib/auth'
import { notFound, payloadTooLarge, readJson, validate } from '../lib/errors'
import { now, toIsoString } from '../lib/ids'
import { notifyLiveMany } from '../lib/live'
import { decodeSerialCursor, encodeSerialCursor, serialCondition, toPage } from '../lib/pagination'

export const logsRoutes = new Hono<{ Bindings: CloudflareBindings }>()

/**
 * docs/SPEC.md §8 defines `INGEST_METRICS_MAX_ITEMS = 1000` for metrics; §10
 * describes the same 413 behavior for logs but shared/types.ts has no
 * equivalent constant, so this mirrors that value locally.
 */
const INGEST_LOGS_MAX_ITEMS = 1000

/**
 * D1 allows at most 100 bound parameters per SQL statement. Each log row binds
 * 4 (job_id, stream, message, logged_at; `id` is emitted as a literal `null`
 * for AUTOINCREMENT), so a single INSERT fails above 25 rows. Rows are split
 * into chunks of this size and sent together with `db.batch`, which is one
 * round trip and runs as a single transaction.
 */
const LOGS_INSERT_CHUNK_ROWS = 20

const chunk = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  )

const pathIds = (
  projectId: string | undefined,
  jobId: string | undefined,
): { projectId: string; jobId: string } => {
  if (projectId === undefined || jobId === undefined) {
    throw notFound('job not found')
  }
  return { projectId, jobId }
}

const findProjectAndJob = async (
  db: Db,
  projectId: string,
  jobId: string,
): Promise<{ project: ProjectRow; job: JobRow }> => {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
  if (project === undefined) {
    throw notFound('project not found')
  }
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) })
  if (job === undefined || job.projectId !== project.id) {
    throw notFound('job not found')
  }
  return { project, job }
}

const toLogLine = (row: LogRow): LogLine => ({
  id: row.id.toString(10),
  job_id: row.jobId,
  stream: row.stream,
  message: row.message,
  logged_at: toIsoString(row.loggedAt),
})

logsRoutes.post('/', async (c) => {
  const { projectId, jobId } = pathIds(c.req.param('project_id'), c.req.param('job_id'))
  const db = createDb(c.env.DB)
  const user = await requireBearerUser(c.env, c.req.raw)
  const { project } = await findProjectAndJob(db, projectId, jobId)
  if (!canWriteProject(project, user)) {
    // docs/SPEC.md §7 treats a missing write permission as 404 (hides existence); §10 follows the same rule.
    throw notFound('job not found')
  }

  const body = await readJson(c.req.raw, ingestLogsRequestSchema)
  if (body.logs.length > INGEST_LOGS_MAX_ITEMS) {
    throw payloadTooLarge(`at most ${INGEST_LOGS_MAX_ITEMS} log lines per request`)
  }
  if (body.logs.length === 0) {
    return c.json({ accepted: 0 }, 202)
  }

  const receivedAt = now()
  const rows = body.logs.map((line) => ({
    jobId,
    stream: line.stream,
    message: line.message,
    loggedAt: line.logged_at === undefined ? receivedAt : dayjs(line.logged_at).toDate(),
  }))
  const [first, ...rest] = chunk(rows, LOGS_INSERT_CHUNK_ROWS).map((part) =>
    db.insert(logs).values(part).returning(),
  )
  if (first === undefined) {
    return c.json({ accepted: 0 }, 202)
  }
  const inserted = (await db.batch([first, ...rest])).flat()

  c.executionCtx.waitUntil(
    notifyLiveMany(
      c.env,
      jobId,
      inserted.map((row) => ({ type: 'log', data: toLogLine(row) })),
    ),
  )
  return c.json({ accepted: inserted.length }, 202)
})

logsRoutes.get('/', async (c) => {
  const { projectId, jobId } = pathIds(c.req.param('project_id'), c.req.param('job_id'))
  const db = createDb(c.env.DB)
  const { project, job } = await findProjectAndJob(db, projectId, jobId)
  const viewer = await resolveViewer(c.env, c.req.raw)
  assertCanViewProject(project, viewer)

  const query = validate(listLogsQuerySchema, c.req.query())

  if (query.after !== undefined) {
    const afterId = decodeSerialCursor(query.after)
    const rows = await db
      .select()
      .from(logs)
      .where(and(eq(logs.jobId, job.id), serialCondition(logs.id, afterId, 'asc')))
      .orderBy(asc(logs.id))
      .limit(query.limit + 1)
    return c.json(toPage(rows, query.limit, toLogLine, (row) => encodeSerialCursor(row.id)))
  }

  const beforeId = query.before === undefined ? undefined : decodeSerialCursor(query.before)
  const rows = await db
    .select()
    .from(logs)
    .where(
      and(
        eq(logs.jobId, job.id),
        beforeId === undefined ? undefined : serialCondition(logs.id, beforeId, 'desc'),
      ),
    )
    .orderBy(desc(logs.id))
    .limit(query.limit + 1)
  const pageRows = rows.slice(0, query.limit)
  const oldest = pageRows.at(-1)
  const page: Page<LogLine> = {
    items: pageRows.map(toLogLine).reverse(),
    next_cursor:
      rows.length > query.limit && oldest !== undefined ? encodeSerialCursor(oldest.id) : null,
  }
  return c.json(page)
})
