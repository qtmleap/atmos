// docs/SPEC.md §9 Media: upload, list and stream job media assets (images/audio).
//
// Mounted at /api/projects/:project_id/jobs/:job_id/media (integration step,
// docs/PLAN.md §8 / src/api/app.ts). Handlers read `project_id` / `job_id`
// from that mount prefix via `c.req.param()`.
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  createDb,
  type Db,
  type JobRow,
  jobs,
  type MediaAssetRow,
  mediaAssets,
  type ProjectRow,
  projects,
} from '../../db/schema'
import { listMediaQuerySchema, uploadMediaFieldsSchema } from '../../shared/schemas'
import { MEDIA_CONTENT_TYPES, MEDIA_MAX_BYTES, type MediaAsset } from '../../shared/types'
import {
  assertCanViewProject,
  canWriteProject,
  requireBearerUser,
  resolveViewer,
} from '../lib/auth'
import { ApiError, badRequest, notFound, payloadTooLarge, validate } from '../lib/errors'
import { newId, now, toIsoString } from '../lib/ids'
import { notifyLive } from '../lib/live'
import { decodeKeysetCursor, encodeKeysetCursor, keysetCondition, toPage } from '../lib/pagination'

export const mediaRoutes = new Hono<{ Bindings: CloudflareBindings }>()

/** `project_id` / `job_id` from the mount prefix, required by every handler below. */
const pathIds = (
  projectId: string | undefined,
  jobId: string | undefined,
): { projectId: string; jobId: string } => {
  if (projectId === undefined || jobId === undefined) {
    throw notFound('job not found')
  }
  return { projectId, jobId }
}

/** Looks up project and job, throwing 404 when either is missing or the parent/child relationship does not hold. */
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

const toMediaAsset = (row: MediaAssetRow, projectId: string): MediaAsset => ({
  id: row.id,
  job_id: row.jobId,
  step: row.step,
  kind: row.kind,
  label: row.label,
  content_type: row.contentType,
  size: row.size,
  url: `/api/projects/${projectId}/jobs/${row.jobId}/media/${row.id}`,
  logged_at: toIsoString(row.loggedAt),
})

mediaRoutes.post('/', async (c) => {
  const { projectId, jobId } = pathIds(c.req.param('project_id'), c.req.param('job_id'))
  const db = createDb(c.env.DB)
  const user = await requireBearerUser(c.env, c.req.raw)
  const { project } = await findProjectAndJob(db, projectId, jobId)
  if (!canWriteProject(project, user)) {
    // docs/SPEC.md §7 treats a missing write permission as 404 (hides existence); §9 follows the same rule.
    throw notFound('job not found')
  }

  const form = await c.req.raw.formData().catch(() => {
    throw badRequest('request body is not valid multipart/form-data')
  })
  const file = form.get('file')
  if (!(file instanceof File)) {
    throw badRequest('file is required')
  }
  const fields = validate(uploadMediaFieldsSchema, {
    kind: form.get('kind'),
    step: form.get('step'),
    label: form.get('label'),
  })

  if (file.size > MEDIA_MAX_BYTES) {
    throw payloadTooLarge('file exceeds the 2048KB limit')
  }
  const allowedTypes: readonly string[] = MEDIA_CONTENT_TYPES[fields.kind]
  if (!allowedTypes.includes(file.type)) {
    throw new ApiError(
      400,
      'invalid_content_type',
      `${fields.kind} does not accept content type "${file.type}"`,
    )
  }

  const id = newId()
  const r2Key = `media/${jobId}/${id}`
  await c.env.BUCKET.put(r2Key, file, { httpMetadata: { contentType: file.type } })

  const row: MediaAssetRow = {
    id,
    jobId,
    step: fields.step,
    kind: fields.kind,
    label: fields.label,
    r2Key,
    contentType: file.type,
    size: file.size,
    loggedAt: now(),
  }
  await db.insert(mediaAssets).values(row)

  const asset = toMediaAsset(row, projectId)
  c.executionCtx.waitUntil(notifyLive(c.env, jobId, { type: 'media', data: asset }))
  return c.json(asset, 201)
})

mediaRoutes.get('/', async (c) => {
  const { projectId, jobId } = pathIds(c.req.param('project_id'), c.req.param('job_id'))
  const db = createDb(c.env.DB)
  const { project, job } = await findProjectAndJob(db, projectId, jobId)
  const viewer = await resolveViewer(c.env, c.req.raw)
  assertCanViewProject(project, viewer)

  const query = validate(listMediaQuerySchema, c.req.query())
  const cursor = query.cursor === undefined ? undefined : decodeKeysetCursor(query.cursor)
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.jobId, job.id),
        query.kind === undefined ? undefined : eq(mediaAssets.kind, query.kind),
        cursor === undefined
          ? undefined
          : keysetCondition(mediaAssets.loggedAt, mediaAssets.id, cursor, 'desc'),
      ),
    )
    .orderBy(desc(mediaAssets.loggedAt), desc(mediaAssets.id))
    .limit(query.limit + 1)

  return c.json(
    toPage(
      rows,
      query.limit,
      (row) => toMediaAsset(row, projectId),
      (row) => encodeKeysetCursor(row.loggedAt, row.id),
    ),
  )
})

mediaRoutes.get('/:media_id', async (c) => {
  const { projectId, jobId } = pathIds(c.req.param('project_id'), c.req.param('job_id'))
  const mediaId = c.req.param('media_id')
  const db = createDb(c.env.DB)
  const { project, job } = await findProjectAndJob(db, projectId, jobId)
  const viewer = await resolveViewer(c.env, c.req.raw)
  assertCanViewProject(project, viewer)

  const row = await db.query.mediaAssets.findFirst({ where: eq(mediaAssets.id, mediaId) })
  if (row === undefined || row.jobId !== job.id) {
    throw notFound('media not found')
  }
  const object = await c.env.BUCKET.get(row.r2Key)
  if (object === null) {
    throw notFound('media not found')
  }
  return c.body(object.body, 200, {
    'Content-Type': row.contentType,
    'Content-Length': row.size.toString(10),
  })
})
