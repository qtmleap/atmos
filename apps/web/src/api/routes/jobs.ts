// Jobs endpoints (docs/SPEC.md §7).
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  createDb,
  type Db,
  type JobRow,
  jobs,
  type ProjectRow,
  projects,
  type UserRow,
} from '../../db/schema'
import {
  createJobRequestSchema,
  finishJobRequestSchema,
  listJobsQuerySchema,
  updateJobRequestSchema,
} from '../../shared/schemas'
import type { Job } from '../../shared/types'
import {
  assertCanViewProject,
  canManageProject,
  canViewProject,
  canWriteProject,
  readBearerToken,
  requireAccessUser,
  requireBearerUser,
  resolveViewer,
} from '../lib/auth'
import { conflict, forbidden, notFound, readJson, validate } from '../lib/errors'
import { newId, now, toIsoString, toIsoStringOrNull } from '../lib/ids'
import { notifyLive } from '../lib/live'
import { deleteJobMedia } from '../lib/media-cleanup'
import { decodeKeysetCursor, encodeKeysetCursor, keysetCondition, toPage } from '../lib/pagination'

export const jobsRoutes = new Hono<{ Bindings: CloudflareBindings }>()

const toJob = (job: JobRow): Job => ({
  id: job.id,
  project_id: job.projectId,
  name: job.name,
  status: job.status,
  config: job.config,
  created_by: job.createdBy,
  started_at: toIsoString(job.startedAt),
  finished_at: toIsoStringOrNull(job.finishedAt),
})

/** project_id/job_id mismatches are reported as a job 404 (docs/SPEC.md §7). */
const findProject = async (db: Db, projectId: string): Promise<ProjectRow | null> => {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
  return project === undefined ? null : project
}

const findScopedJob = async (db: Db, projectId: string, jobId: string): Promise<JobRow | null> => {
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.projectId, projectId)),
  })
  return job === undefined ? null : job
}

// POST /api/projects/:project_id/jobs — Bearer token; only the project owner writes.
jobsRoutes.post('/:project_id/jobs', async (c) => {
  const user = await requireBearerUser(c.env, c.req.raw)
  const db = createDb(c.env.DB)
  const project = await findProject(db, c.req.param('project_id'))
  if (project === null || !canWriteProject(project, user)) {
    throw notFound('project not found')
  }
  const body = await readJson(c.req.raw, createJobRequestSchema)
  const created: JobRow = {
    id: newId(),
    projectId: project.id,
    name: body.name === undefined ? null : body.name,
    status: 'running',
    config: body.config,
    createdBy: user.id,
    startedAt: now(),
    finishedAt: null,
  }
  await db.insert(jobs).values(created)
  return c.json(toJob(created), 201)
})

// GET /api/projects/:project_id/jobs — public unless the project is private.
jobsRoutes.get('/:project_id/jobs', async (c) => {
  const db = createDb(c.env.DB)
  const project = await findProject(db, c.req.param('project_id'))
  if (project === null) {
    throw notFound('project not found')
  }
  const viewer = await resolveViewer(c.env, c.req.raw)
  assertCanViewProject(project, viewer)
  const query = validate(listJobsQuerySchema, c.req.query())
  const cursorCondition =
    query.cursor === undefined
      ? undefined
      : keysetCondition(jobs.startedAt, jobs.id, decodeKeysetCursor(query.cursor), 'desc')
  const rows = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.projectId, project.id),
        query.status === undefined ? undefined : eq(jobs.status, query.status),
        cursorCondition,
      ),
    )
    .orderBy(desc(jobs.startedAt), desc(jobs.id))
    .limit(query.limit + 1)
  return c.json(
    toPage(rows, query.limit, toJob, (row) => encodeKeysetCursor(row.startedAt, row.id)),
  )
})

// GET /api/projects/:project_id/jobs/:job_id
jobsRoutes.get('/:project_id/jobs/:job_id', async (c) => {
  const db = createDb(c.env.DB)
  const project = await findProject(db, c.req.param('project_id'))
  if (project === null) {
    throw notFound('project not found')
  }
  const viewer = await resolveViewer(c.env, c.req.raw)
  assertCanViewProject(project, viewer)
  const job = await findScopedJob(db, project.id, c.req.param('job_id'))
  if (job === null) {
    throw notFound('job not found')
  }
  return c.json(toJob(job))
})

// POST /api/projects/:project_id/jobs/:job_id/finish — Bearer token.
jobsRoutes.post('/:project_id/jobs/:job_id/finish', async (c) => {
  const user = await requireBearerUser(c.env, c.req.raw)
  const db = createDb(c.env.DB)
  const project = await findProject(db, c.req.param('project_id'))
  if (project === null || !canWriteProject(project, user)) {
    throw notFound('project not found')
  }
  const job = await findScopedJob(db, project.id, c.req.param('job_id'))
  if (job === null) {
    throw notFound('job not found')
  }
  if (job.status !== 'running') {
    throw conflict('job is already finished')
  }
  const body = await readJson(c.req.raw, finishJobRequestSchema)
  const finishedAt = now()
  await db.update(jobs).set({ status: body.status, finishedAt }).where(eq(jobs.id, job.id))
  const updated: JobRow = { ...job, status: body.status, finishedAt }
  c.executionCtx.waitUntil(
    notifyLive(c.env, job.id, {
      type: 'status',
      data: { status: body.status, finished_at: toIsoString(finishedAt) },
    }),
  )
  return c.json(toJob(updated))
})

/**
 * project_id/job_id lookup shared by PATCH/DELETE. Unlike POST/finish (Bearer
 * token, owner-only, missing write permission hides as 404 via canWriteProject),
 * these are also reachable from the web UI by an admin acting on someone
 * else's project, so the caller decides 403 vs 404 with canViewProject /
 * canManageProject (docs/SPEC.md §6/§7).
 */
const findManageableJob = async (
  db: Db,
  user: UserRow,
  projectId: string,
  jobId: string,
): Promise<{ project: ProjectRow; job: JobRow }> => {
  const project = await findProject(db, projectId)
  if (project === null || !canViewProject(project, user)) {
    throw notFound('project not found')
  }
  const job = await findScopedJob(db, project.id, jobId)
  if (job === null) {
    throw notFound('job not found')
  }
  if (!canManageProject(project, user)) {
    throw forbidden('only the project owner or an admin may edit this job')
  }
  return { project, job }
}

// PATCH /api/projects/:project_id/jobs/:job_id (追加分) — the project owner
// or an admin renames a job; `name: null` clears it.
jobsRoutes.patch('/:project_id/jobs/:job_id', async (c) => {
  const viaBearer = readBearerToken(c.req.raw) !== null
  const user = viaBearer
    ? await requireBearerUser(c.env, c.req.raw)
    : await requireAccessUser(c.env, c.req.raw)
  const db = createDb(c.env.DB)
  const { job } = await findManageableJob(
    db,
    user,
    c.req.param('project_id'),
    c.req.param('job_id'),
  )
  const body = await readJson(c.req.raw, updateJobRequestSchema)
  await db.update(jobs).set({ name: body.name }).where(eq(jobs.id, job.id))
  return c.json(toJob({ ...job, name: body.name }))
})

// DELETE /api/projects/:project_id/jobs/:job_id (追加分) — the project owner
// or an admin deletes the job along with its metrics, logs and media (D1
// cascades metrics/logs/media_assets on the job foreign key; R2 objects are
// removed explicitly first, and no live broadcast is sent).
jobsRoutes.delete('/:project_id/jobs/:job_id', async (c) => {
  const viaBearer = readBearerToken(c.req.raw) !== null
  const user = viaBearer
    ? await requireBearerUser(c.env, c.req.raw)
    : await requireAccessUser(c.env, c.req.raw)
  const db = createDb(c.env.DB)
  const { job } = await findManageableJob(
    db,
    user,
    c.req.param('project_id'),
    c.req.param('job_id'),
  )
  await deleteJobMedia(c.env.BUCKET, db, job.id)
  await db.delete(jobs).where(eq(jobs.id, job.id))
  return c.body(null, 204)
})
