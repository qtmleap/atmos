// docs/SPEC.md §3 — Admin: GET/POST /api/admin/users, PATCH /api/admin/users/:user_id.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDb, users } from '../../src/db/schema'
import { pageSchema, userWithEmailSchema } from '../../src/shared/schemas'
import { insertUser } from '../helpers/fixtures'
import { jsonError, jsonShaped } from '../helpers/http'
import { createRoutesTestEnv, type RoutesTestEnv } from '../helpers/routes-env'

const TIMEOUT = 60_000

const t: { current: RoutesTestEnv | null } = { current: null }
const testEnv = (): RoutesTestEnv => {
  if (t.current === null) {
    throw new Error('test env not started')
  }
  return t.current
}

beforeAll(async () => {
  t.current = await createRoutesTestEnv()
}, TIMEOUT)

afterAll(async () => {
  if (t.current !== null) {
    await t.current.dispose()
  }
})

describe('GET /api/admin/users', () => {
  test('401 without an Access identity', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/admin/users')
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('403 for a signed-in non-admin', async () => {
    const { access, dispatch, env } = testEnv()
    const plain = await insertUser(env.DB, { role: 'user' })
    const res = await dispatch('/api/admin/users', {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: plain.cfAccessEmail }) },
    })
    expect(res.status).toBe(403)
    await jsonError(res, 'forbidden')
  })

  test('lists every user with their email, paginated', async () => {
    const { access, dispatch, env } = testEnv()
    const admin = await insertUser(env.DB, { role: 'admin' })
    await insertUser(env.DB)
    await insertUser(env.DB)
    const headers = { 'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }) }

    const first = await dispatch('/api/admin/users?limit=2', { headers })
    expect(first.status).toBe(200)
    const firstBody = await jsonShaped(pageSchema(userWithEmailSchema), first)
    expect(firstBody.items).toHaveLength(2)
    expect(firstBody.items[0]?.cf_access_email).toBeDefined()
    expect(firstBody.next_cursor).not.toBeNull()

    const second = await dispatch(
      `/api/admin/users?limit=2&cursor=${encodeURIComponent(firstBody.next_cursor === null ? '' : firstBody.next_cursor)}`,
      { headers },
    )
    const secondBody = await jsonShaped(pageSchema(userWithEmailSchema), second)
    const seen = new Set([...firstBody.items.map((u) => u.handle)])
    for (const item of secondBody.items) {
      expect(seen.has(item.handle)).toBe(false)
    }
  })
})

describe('POST /api/admin/users', () => {
  test('creates a user with the given role', async () => {
    const { access, dispatch, env } = testEnv()
    const admin = await insertUser(env.DB, { role: 'admin' })
    const res = await dispatch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }),
      },
      body: JSON.stringify({
        cf_access_email: 'created@example.com',
        handle: 'created-user',
        display_name: 'Created User',
        role: 'user',
      }),
    })
    expect(res.status).toBe(201)
    const body = await jsonShaped(userWithEmailSchema, res)
    expect(body).toMatchObject({
      handle: 'created-user',
      display_name: 'Created User',
      role: 'user',
      cf_access_email: 'created@example.com',
    })

    const stored = await createDb(env.DB).query.users.findFirst({
      where: (row, { eq }) => eq(row.handle, 'created-user'),
    })
    expect(stored).not.toBeUndefined()
  })

  test('409 conflict on a duplicate handle or email', async () => {
    const { access, dispatch, env } = testEnv()
    const admin = await insertUser(env.DB, { role: 'admin' })
    const other = await insertUser(env.DB)
    const headers = {
      'Content-Type': 'application/json',
      'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }),
    }

    const byHandle = await dispatch('/api/admin/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cf_access_email: 'fresh@example.com',
        handle: other.handle,
        display_name: 'Someone',
        role: 'user',
      }),
    })
    expect(byHandle.status).toBe(409)
    await jsonError(byHandle, 'conflict')

    const byEmail = await dispatch('/api/admin/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cf_access_email: other.cfAccessEmail,
        handle: 'fresh-handle',
        display_name: 'Someone',
        role: 'user',
      }),
    })
    expect(byEmail.status).toBe(409)
    await jsonError(byEmail, 'conflict')
  })

  test('403 for a non-admin caller', async () => {
    const { access, dispatch, env } = testEnv()
    const plain = await insertUser(env.DB, { role: 'user' })
    const res = await dispatch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: plain.cfAccessEmail }),
      },
      body: JSON.stringify({
        cf_access_email: 'x@example.com',
        handle: 'somebody',
        display_name: 'Somebody',
        role: 'user',
      }),
    })
    expect(res.status).toBe(403)
    await jsonError(res, 'forbidden')
  })
})

describe('PATCH /api/admin/users/:user_id', () => {
  test('changes a role', async () => {
    const { access, dispatch, env } = testEnv()
    const admin = await insertUser(env.DB, { role: 'admin' })
    const target = await insertUser(env.DB, { role: 'user' })
    const res = await dispatch(`/api/admin/users/${target.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }),
      },
      body: JSON.stringify({ role: 'admin' }),
    })
    expect(res.status).toBe(200)
    expect(await jsonShaped(userWithEmailSchema, res)).toMatchObject({
      handle: target.handle,
      role: 'admin',
    })
  })

  test('404 for an unknown user_id', async () => {
    const { access, dispatch, env } = testEnv()
    const admin = await insertUser(env.DB, { role: 'admin' })
    const res = await dispatch('/api/admin/users/00000000-0000-4000-8000-000000000000', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }),
      },
      body: JSON.stringify({ role: 'user' }),
    })
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('409 conflict demoting the last admin, including yourself', async () => {
    const { access, dispatch, env } = testEnv()
    const db = createDb(env.DB)
    // Isolate: demote every admin from earlier tests so only one remains.
    await db.update(users).set({ role: 'user' })
    const soleAdmin = await insertUser(env.DB, { role: 'admin' })
    const res = await dispatch(`/api/admin/users/${soleAdmin.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: soleAdmin.cfAccessEmail }),
      },
      body: JSON.stringify({ role: 'user' }),
    })
    expect(res.status).toBe(409)
    await jsonError(res, 'conflict')
  })

  test('demoting one of several admins succeeds', async () => {
    const { access, dispatch, env } = testEnv()
    const adminA = await insertUser(env.DB, { role: 'admin' })
    await insertUser(env.DB, { role: 'admin' })
    const res = await dispatch(`/api/admin/users/${adminA.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: adminA.cfAccessEmail }),
      },
      body: JSON.stringify({ role: 'user' }),
    })
    expect(res.status).toBe(200)
    expect(await jsonShaped(userWithEmailSchema, res)).toMatchObject({ role: 'user' })
  })
})
