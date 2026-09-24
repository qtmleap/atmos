// docs/SPEC.md §2 — POST /api/setup.
//
// `users` is empty only once per test env, so the tests that depend on that
// (missing identity, wrong key, success) run in this file's declaration order
// before the test that inserts a row; bun:test runs a file's tests
// sequentially. `already_initialized` runs last, once a row exists.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDb } from '../../src/db/schema'
import { setupResponseSchema } from '../../src/shared/schemas'
import { jsonError, jsonShaped } from '../helpers/http'
import { createRoutesTestEnv, type RoutesTestEnv } from '../helpers/routes-env'

const TIMEOUT = 60_000
const INIT_ADMIN_KEY = 'test-init-admin-key'

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

describe('POST /api/setup', () => {
  test('400 validation_error on a malformed handle', async () => {
    const { access, dispatch } = testEnv()
    const res = await dispatch('/api/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: 'x@example.com' }),
      },
      body: JSON.stringify({ init_admin_key: INIT_ADMIN_KEY, handle: 'a', display_name: 'A' }),
    })
    expect(res.status).toBe(400)
    await jsonError(res, 'validation_error')
  })

  test('401 unauthenticated without an Access identity', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        init_admin_key: INIT_ADMIN_KEY,
        handle: 'nobody',
        display_name: 'Nobody',
      }),
    })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('401 invalid_init_key on a wrong key', async () => {
    const { access, dispatch } = testEnv()
    const res = await dispatch('/api/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: 'x@example.com' }),
      },
      body: JSON.stringify({ init_admin_key: 'wrong', handle: 'nobody', display_name: 'Nobody' }),
    })
    expect(res.status).toBe(401)
    await jsonError(res, 'invalid_init_key')
  })

  test('registers the first admin from the Access identity', async () => {
    const { access, dispatch, env } = testEnv()
    const res = await dispatch('/api/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: 'founder@example.com' }),
      },
      body: JSON.stringify({
        init_admin_key: INIT_ADMIN_KEY,
        handle: 'founder',
        display_name: 'Founder',
      }),
    })
    expect(res.status).toBe(200)
    const body = await jsonShaped(setupResponseSchema, res)
    expect(body).toMatchObject({
      user: {
        handle: 'founder',
        display_name: 'Founder',
        role: 'admin',
        avatar_url: null,
        cf_access_email: 'founder@example.com',
      },
    })

    const stored = await createDb(env.DB).query.users.findFirst({
      where: (row, { eq }) => eq(row.handle, 'founder'),
    })
    expect(stored === undefined ? null : stored.role).toBe('admin')
  })

  test('403 already_initialized once a user exists', async () => {
    const { access, dispatch } = testEnv()
    const res = await dispatch('/api/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: 'second@example.com' }),
      },
      body: JSON.stringify({
        init_admin_key: INIT_ADMIN_KEY,
        handle: 'second',
        display_name: 'Second',
      }),
    })
    expect(res.status).toBe(403)
    await jsonError(res, 'already_initialized')
  })
})
