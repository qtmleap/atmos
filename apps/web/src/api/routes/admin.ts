// docs/SPEC.md §3 — Admin: user list/create/role-change, all Access + admin.
import { count, desc, eq, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { createDb, users } from '../../db/schema'
import { adminCreateUserRequestSchema, adminUpdateUserRequestSchema } from '../../shared/schemas'
import { requireAccessUser, requireAdmin } from '../lib/auth'
import { conflict, notFound, readJson } from '../lib/errors'
import { newId, now } from '../lib/ids'
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  keysetCondition,
  parsePagination,
  toPage,
} from '../lib/pagination'
import { toUserWithEmail } from '../lib/serialize'

export const adminRoutes = new Hono<{ Bindings: CloudflareBindings }>()

adminRoutes.get('/admin/users', async (c) => {
  requireAdmin(await requireAccessUser(c.env, c.req.raw))
  const { limit, cursor } = parsePagination(c.req.query())
  const db = createDb(c.env.DB)
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
  return c.json(
    toPage(rows, limit, toUserWithEmail, (row) => encodeKeysetCursor(row.createdAt, row.id)),
  )
})

adminRoutes.post('/admin/users', async (c) => {
  requireAdmin(await requireAccessUser(c.env, c.req.raw))
  const body = await readJson(c.req.raw, adminCreateUserRequestSchema)
  const db = createDb(c.env.DB)

  const existing = await db.query.users.findFirst({
    where: or(eq(users.handle, body.handle), eq(users.cfAccessEmail, body.cf_access_email)),
  })
  if (existing !== undefined) {
    throw conflict('handle or cf_access_email is already in use')
  }

  const row = {
    id: newId(),
    handle: body.handle,
    displayName: body.display_name,
    avatarKey: null,
    cfAccessEmail: body.cf_access_email,
    role: body.role,
    createdAt: now(),
  }
  await db.insert(users).values(row)
  return c.json(toUserWithEmail(row), 201)
})

adminRoutes.patch('/admin/users/:user_id', async (c) => {
  requireAdmin(await requireAccessUser(c.env, c.req.raw))
  const body = await readJson(c.req.raw, adminUpdateUserRequestSchema)
  const db = createDb(c.env.DB)

  const target = await db.query.users.findFirst({
    where: eq(users.id, c.req.param('user_id')),
  })
  if (target === undefined) {
    throw notFound('user not found')
  }

  if (body.role === undefined || body.role === target.role) {
    return c.json(toUserWithEmail(target))
  }

  if (target.role === 'admin' && body.role === 'user') {
    const totals = await db.select({ total: count() }).from(users).where(eq(users.role, 'admin'))
    const adminCount = totals[0] === undefined ? 0 : totals[0].total
    if (adminCount <= 1) {
      throw conflict('cannot demote the last admin')
    }
  }

  await db.update(users).set({ role: body.role }).where(eq(users.id, target.id))
  return c.json(toUserWithEmail({ ...target, role: body.role }))
})
