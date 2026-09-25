// docs/SPEC.md §4 — Users: directory, profile, their projects, avatar, `/me`.
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { projects, users } from '#schema'
import { projectVisibilityCondition, requireAccessUser, resolveViewer } from '../lib/auth'
import { notFound } from '../lib/errors'
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  keysetCondition,
  parsePagination,
  toPage,
} from '../lib/pagination'
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

  return c.json(
    toPage(
      rows,
      limit,
      (row) => toProject(row, owner),
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
