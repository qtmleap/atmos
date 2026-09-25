// docs/SPEC.md §2 — GET /api/setup: has atmos been set up yet (no auth).
//                    POST /api/setup: registers the very first admin.
import { count } from 'drizzle-orm'
import { Hono } from 'hono'
import { createDb, type Db, users } from '../../db/schema'
import { setupRequestSchema } from '../../shared/schemas'
import type { SetupResponse, SetupStatus } from '../../shared/types'
import { requireAccessIdentity } from '../lib/auth'
import { ApiError, readJson } from '../lib/errors'
import { newId, now } from '../lib/ids'
import { toUserWithEmail } from '../lib/serialize'

export const setupRoutes = new Hono<{ Bindings: CloudflareBindings }>()

/** Whether atmos already has at least one registered user. */
const isInitialized = async (db: Db): Promise<boolean> => {
  const totals = await db.select({ total: count() }).from(users)
  const total = totals[0] === undefined ? 0 : totals[0].total
  return total > 0
}

setupRoutes.get('/setup', async (c) => {
  const db = createDb(c.env.DB)
  const response: SetupStatus = { initialized: await isInitialized(db) }
  return c.json(response)
})

setupRoutes.post('/setup', async (c) => {
  const body = await readJson(c.req.raw, setupRequestSchema)
  const db = createDb(c.env.DB)

  // A fresh install only: once any user exists, setup is done for good.
  if (await isInitialized(db)) {
    throw new ApiError(403, 'already_initialized', 'atmos already has a registered user')
  }

  const identity = await requireAccessIdentity(c.env, c.req.raw)
  if (body.init_admin_key !== c.env.INIT_ADMIN_KEY) {
    throw new ApiError(401, 'invalid_init_key', 'init_admin_key does not match')
  }

  const row = {
    id: newId(),
    handle: body.handle,
    displayName: body.display_name,
    avatarKey: null,
    cfAccessEmail: identity.email,
    role: 'admin' as const,
    createdAt: now(),
  }
  await db.insert(users).values(row)

  const response: SetupResponse = { user: toUserWithEmail(row) }
  return c.json(response)
})
