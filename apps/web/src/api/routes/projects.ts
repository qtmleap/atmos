// Projects endpoints (docs/SPEC.md §6).
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { createDb, type ProjectRow, projects, type UserRow, users } from '../../db/schema'
import { createProjectRequestSchema } from '../../shared/schemas'
import type { Project } from '../../shared/types'
import {
  assertCanViewProject,
  projectVisibilityCondition,
  readBearerToken,
  requireAccessUser,
  requireBearerUser,
  resolveViewer,
} from '../lib/auth'
import { conflict, notFound, readJson } from '../lib/errors'
import { newId, now, toIsoString } from '../lib/ids'
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  keysetCondition,
  parsePagination,
  toPage,
} from '../lib/pagination'

export const projectsRoutes = new Hono<{ Bindings: CloudflareBindings }>()

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
  const db = createDb(c.env.DB)
  const { limit, cursor } = parsePagination(c.req.query())
  const viewer = await resolveViewer(c.env, c.req.raw)
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
  const db = createDb(c.env.DB)
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
  const viewer = await resolveViewer(c.env, c.req.raw)
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
    ? await requireBearerUser(c.env, c.req.raw)
    : await requireAccessUser(c.env, c.req.raw)
  const body = await readJson(c.req.raw, createProjectRequestSchema)
  const db = createDb(c.env.DB)
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
