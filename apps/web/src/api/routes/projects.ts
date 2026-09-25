// Projects endpoints (docs/SPEC.md §6).
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { type Db, type ProjectRow, projects, type UserRow, users } from '#schema'
import { createProjectRequestSchema, updateProjectRequestSchema } from '../../shared/schemas'
import type { Project } from '../../shared/types'
import {
  assertCanViewProject,
  canManageProject,
  canViewProject,
  projectVisibilityCondition,
  readBearerToken,
  requireAccessUser,
  requireBearerUser,
  resolveViewer,
} from '../lib/auth'
import { conflict, forbidden, notFound, readJson } from '../lib/errors'
import { newId, now, toIsoString } from '../lib/ids'
import { deleteProjectMedia } from '../lib/media-cleanup'
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  keysetCondition,
  parsePagination,
  toPage,
} from '../lib/pagination'
import { type AppEnv, getPlatform } from '../platform/context'

export const projectsRoutes = new Hono<AppEnv>()

const toProject = (
  project: ProjectRow,
  owner: Pick<UserRow, 'id' | 'handle' | 'displayName'>,
): Project => ({
  id: project.id,
  name: project.name,
  visibility: project.visibility,
  owner: { id: owner.id, handle: owner.handle, display_name: owner.displayName },
  created_at: toIsoString(project.createdAt),
})

// GET /api/projects — public projects to everyone, internal ones to any
// signed-in registered user, private ones only to their owner and admins.
projectsRoutes.get('/', async (c) => {
  const db = getPlatform(c).db
  const { limit, cursor } = parsePagination(c.req.query())
  const viewer = await resolveViewer(getPlatform(c), c.req.raw)
  const visibilityCondition = projectVisibilityCondition(viewer)
  const cursorCondition =
    cursor === undefined
      ? undefined
      : keysetCondition(projects.createdAt, projects.id, decodeKeysetCursor(cursor), 'desc')
  const rows = await db
    .select({ project: projects, owner: users })
    .from(projects)
    .innerJoin(users, eq(projects.ownerId, users.id))
    .where(and(visibilityCondition, cursorCondition))
    .orderBy(desc(projects.createdAt), desc(projects.id))
    .limit(limit + 1)
  return c.json(
    toPage(
      rows,
      limit,
      (row) => toProject(row.project, row.owner),
      (row) => encodeKeysetCursor(row.project.createdAt, row.project.id),
    ),
  )
})

// GET /api/projects/:project_id (追加分) — one project by id, for the pages under
// /projects/:projectId. Same visibility rule as the job endpoints (§7): public
// to everyone, private only to the owner (401 anonymous / 403 other viewers).
projectsRoutes.get('/:project_id', async (c) => {
  const db = getPlatform(c).db
  const rows = await db
    .select({ project: projects, owner: users })
    .from(projects)
    .innerJoin(users, eq(projects.ownerId, users.id))
    .where(eq(projects.id, c.req.param('project_id')))
    .limit(1)
  const row = rows[0]
  if (row === undefined) {
    throw notFound('project not found')
  }
  const viewer = await resolveViewer(getPlatform(c), c.req.raw)
  assertCanViewProject(row.project, viewer)
  return c.json(toProject(row.project, row.owner))
})

// POST /api/projects — two credentials, two semantics:
//   - Bearer access token (`wb.init()`): get-or-create keyed on (token owner,
//     name); 200 for the existing project, 201 for a newly created one.
//   - Cloudflare Access, no Bearer (the web UI's "new project" form): create
//     only; 409 `conflict` when the signed-in owner already has a project by
//     this name, 201 on success.
// Neither credential present (nor valid) is 401 `unauthenticated`, from
// requireBearerUser / requireAccessUser.
projectsRoutes.post('/', async (c) => {
  const viaBearer = readBearerToken(c.req.raw) !== null
  const user = viaBearer
    ? await requireBearerUser(getPlatform(c), c.req.raw)
    : await requireAccessUser(getPlatform(c), c.req.raw)
  const body = await readJson(c.req.raw, createProjectRequestSchema)
  const db = getPlatform(c).db
  // Same-owner duplicates are possible in principle (name is not unique); the
  // oldest one wins (docs/SPEC.md §6 "補足").
  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.ownerId, user.id), eq(projects.name, body.name)),
    orderBy: (row, { asc: ascending }) => ascending(row.createdAt),
  })
  if (existing !== undefined) {
    if (!viaBearer) {
      throw conflict('a project with this name already exists')
    }
    return c.json(toProject(existing, user), 200)
  }
  const created: ProjectRow = {
    id: newId(),
    name: body.name,
    visibility: body.visibility,
    ownerId: user.id,
    createdAt: now(),
  }
  await db.insert(projects).values(created)
  return c.json(toProject(created, user), 201)
})

/** project_id lookup shared by PATCH/DELETE, with its owner for the response and 409 check. */
const findProjectWithOwner = async (
  db: Db,
  projectId: string,
): Promise<{ project: ProjectRow; owner: UserRow } | null> => {
  const rows = await db
    .select({ project: projects, owner: users })
    .from(projects)
    .innerJoin(users, eq(projects.ownerId, users.id))
    .where(eq(projects.id, projectId))
    .limit(1)
  const row = rows[0]
  return row === undefined ? null : row
}

// PATCH /api/projects/:project_id (追加分) — the owner or an admin edits name
// and/or visibility. Same two credentials as POST; a missing/invalid one is
// 401 from requireBearerUser / requireAccessUser. A project the caller cannot
// even view is reported as 404, one they can view but not manage as 403
// (docs/SPEC.md §6/§7 canManageProject convention).
projectsRoutes.patch('/:project_id', async (c) => {
  const viaBearer = readBearerToken(c.req.raw) !== null
  const user = viaBearer
    ? await requireBearerUser(getPlatform(c), c.req.raw)
    : await requireAccessUser(getPlatform(c), c.req.raw)
  const db = getPlatform(c).db
  const found = await findProjectWithOwner(db, c.req.param('project_id'))
  if (found === null || !canViewProject(found.project, user)) {
    throw notFound('project not found')
  }
  if (!canManageProject(found.project, user)) {
    throw forbidden('only the owner or an admin may edit this project')
  }
  const body = await readJson(c.req.raw, updateProjectRequestSchema)
  if (body.name !== undefined && body.name !== found.project.name) {
    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.ownerId, found.project.ownerId), eq(projects.name, body.name)),
    })
    if (existing !== undefined && existing.id !== found.project.id) {
      throw conflict('a project with this name already exists')
    }
  }
  const updated: ProjectRow = {
    ...found.project,
    name: body.name === undefined ? found.project.name : body.name,
    visibility: body.visibility === undefined ? found.project.visibility : body.visibility,
  }
  await db
    .update(projects)
    .set({ name: updated.name, visibility: updated.visibility })
    .where(eq(projects.id, updated.id))
  return c.json(toProject(updated, found.owner))
})

// DELETE /api/projects/:project_id (追加分) — the owner or an admin deletes
// the project along with its jobs, metrics, logs and media (D1 cascades
// jobs/metrics/logs/media_assets on the project/job foreign keys; R2 objects
// are not part of that cascade and are removed explicitly first).
projectsRoutes.delete('/:project_id', async (c) => {
  const viaBearer = readBearerToken(c.req.raw) !== null
  const user = viaBearer
    ? await requireBearerUser(getPlatform(c), c.req.raw)
    : await requireAccessUser(getPlatform(c), c.req.raw)
  const db = getPlatform(c).db
  const found = await findProjectWithOwner(db, c.req.param('project_id'))
  if (found === null || !canViewProject(found.project, user)) {
    throw notFound('project not found')
  }
  if (!canManageProject(found.project, user)) {
    throw forbidden('only the owner or an admin may delete this project')
  }
  await deleteProjectMedia(getPlatform(c).storage, db, found.project.id)
  await db.delete(projects).where(eq(projects.id, found.project.id))
  return c.body(null, 204)
})
