// docs/SPEC.md §4 — Users: directory, profile, their projects, avatar, `/me`.
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { projects, users } from '#schema'
import { safeReturnPath } from '../../shared/return-path'
import {
  projectVisibilityCondition,
  requireAccessIdentity,
  requireAccessUser,
  resolveViewer,
} from '../lib/auth'
import { notFound } from '../lib/errors'
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  keysetCondition,
  parsePagination,
  toPage,
} from '../lib/pagination'
import { loadProjectSummaries } from '../lib/project-summary'
import { toProject, toUser, toUserWithEmail } from '../lib/serialize'
import { type AppEnv, getPlatform } from '../platform/context'

export const usersRoutes = new Hono<AppEnv>()

usersRoutes.get('/users', async (c) => {
  await requireAccessUser(getPlatform(c), c.req.raw)
  const { limit, cursor } = parsePagination(c.req.query())
  const db = getPlatform(c).db
  const rows = await db
    .select()
    .from(users)
    .where(
      cursor === undefined
        ? undefined
        : keysetCondition(users.createdAt, users.id, decodeKeysetCursor(cursor), 'desc'),
    )
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit + 1)
  return c.json(toPage(rows, limit, toUser, (row) => encodeKeysetCursor(row.createdAt, row.id)))
})

usersRoutes.get('/users/:handle', async (c) => {
  const db = getPlatform(c).db
  const target = await db.query.users.findFirst({
    where: eq(users.handle, c.req.param('handle')),
  })
  if (target === undefined) {
    throw notFound('user not found')
  }
  return c.json(toUser(target))
})

usersRoutes.get('/users/:handle/projects', async (c) => {
  const db = getPlatform(c).db
  const owner = await db.query.users.findFirst({
    where: eq(users.handle, c.req.param('handle')),
  })
  if (owner === undefined) {
    throw notFound('user not found')
  }

  const viewer = await resolveViewer(getPlatform(c), c.req.raw)
  const { limit, cursor } = parsePagination(c.req.query())

  const rows = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, owner.id),
        projectVisibilityCondition(viewer),
        cursor === undefined
          ? undefined
          : keysetCondition(projects.createdAt, projects.id, decodeKeysetCursor(cursor), 'desc'),
      ),
    )
    .orderBy(desc(projects.createdAt), desc(projects.id))
    .limit(limit + 1)

  const summaries = await loadProjectSummaries(db, rows.slice(0, limit))
  return c.json(
    toPage(
      rows,
      limit,
      (row) => toProject(row, owner, summaries.get(row.id)),
      (row) => encodeKeysetCursor(row.createdAt, row.id),
    ),
  )
})

usersRoutes.get('/users/:handle/avatar', async (c) => {
  const db = getPlatform(c).db
  const target = await db.query.users.findFirst({
    where: eq(users.handle, c.req.param('handle')),
  })
  if (target === undefined || target.avatarKey === null) {
    throw notFound('avatar not set')
  }
  const object = await getPlatform(c).storage.get(target.avatarKey)
  if (object === null) {
    throw notFound('avatar not set')
  }
  return new Response(object.body, {
    headers: {
      'Content-Type': object.contentType === null ? 'application/octet-stream' : object.contentType,
    },
  })
})

usersRoutes.get('/me', async (c) => {
  const user = await requireAccessUser(getPlatform(c), c.req.raw)
  return c.json(toUserWithEmail(user))
})

// The web UI's login entry (docs/SPEC.md §4). Access protects every /api/me
// path, so a signed-out visitor is sent to the login before this runs and comes
// back here afterwards; the visitor is then returned to the page they came
// from. Needs an identity only, not a registered user: someone who signed in
// but has no atmos user must still land on the page that tells them so.
// Without an identity (this path not behind the proxy) it is a 401 rather than
// a silent bounce, so a missing Access path shows up instead of looking like a
// login that does nothing.
usersRoutes.get('/me/login', async (c) => {
  await requireAccessIdentity(getPlatform(c), c.req.raw)
  return c.redirect(safeReturnPath(c.req.query('redirect')), 302)
})
