// docs/SPEC.md §11 Live: WebSocket upgrade, fanned out per job by the JobLive
// Durable Object (src/api/durable-objects/job-live.ts).
//
// Mounted at /api/projects/:project_id/jobs/:job_id/live (integration step,
// docs/PLAN.md §8 / src/api/app.ts). Handler reads `project_id` / `job_id`
// from that mount prefix via `c.req.param()`.
//
// docs/SPEC.md §11 defines close codes 4404/4403 for "connection already
// open when the check fails", but the check here (existence + visibility)
// runs *before* the Upgrade is handed to the Durable Object ("Upgrade前に
// Workerが弾く想定"), so a failure is a plain HTTP error response
// (404/401/403) rather than an opened-then-closed socket.
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { type Db, type JobRow, jobs, type ProjectRow, projects } from '#schema'
import { assertCanViewProject, resolveViewer } from '../lib/auth'
import { notFound } from '../lib/errors'
import { connectLive } from '../lib/live'
import { type AppEnv, getPlatform } from '../platform/context'
import type { Platform } from '../platform/types'

export const liveRoutes = new Hono<AppEnv>()

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

/**
 * Existence + visibility check for the live channel, kept separate from the
 * route handler so it is unit-testable without a real WebSocket upgrade:
 * throws 404 `not_found` when `project_id` / `job_id` do not exist or their
 * parent/child relationship does not hold, 401 `unauthenticated` for an
 * anonymous viewer of a private project, 403 `forbidden` for a signed-in
 * non-owner. Resolves to the job on success.
 */
export const checkLiveAccess = async (
  platform: Pick<Platform, 'auth' | 'db'>,
  request: Request,
  projectId: string,
  jobId: string,
): Promise<JobRow> => {
  const { project, job } = await findProjectAndJob(platform.db, projectId, jobId)
  const viewer = await resolveViewer(platform, request)
  assertCanViewProject(project, viewer)
  return job
}

liveRoutes.get('/', async (c) => {
  const projectId = c.req.param('project_id')
  const jobId = c.req.param('job_id')
  if (projectId === undefined || jobId === undefined) {
    throw notFound('job not found')
  }
  const job = await checkLiveAccess(getPlatform(c), c.req.raw, projectId, jobId)
  return connectLive(getPlatform(c).live, job.id, c.req.raw)
})
