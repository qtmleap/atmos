// docs/SPEC.md §5 — Settings: profile, avatar upload, access tokens.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { hashAccessToken } from '../../src/api/lib/auth'
import { createDb } from '../../src/db/schema'
import {
  accessTokenCreatedSchema,
  updateAvatarResponseSchema,
  userWithEmailSchema,
} from '../../src/shared/schemas'
import { AVATAR_MAX_BYTES } from '../../src/shared/types'
import { insertAccessToken, insertUser } from '../helpers/fixtures'
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

describe('PATCH /api/settings/profile', () => {
  test('401 without an Access identity', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'x' }),
    })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('updates handle and display_name', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    const res = await dispatch('/api/settings/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }),
      },
      body: JSON.stringify({ handle: 'renamed-handle', display_name: 'Renamed' }),
    })
    expect(res.status).toBe(200)
    expect(await jsonShaped(userWithEmailSchema, res)).toMatchObject({
      handle: 'renamed-handle',
      display_name: 'Renamed',
    })
  })

  test('400 validation_error on a malformed handle', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    const res = await dispatch('/api/settings/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }),
      },
      body: JSON.stringify({ handle: '!!' }),
    })
    expect(res.status).toBe(400)
    await jsonError(res, 'validation_error')
  })

  test('409 conflict on a handle already in use', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    const other = await insertUser(env.DB)
    const res = await dispatch('/api/settings/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }),
      },
      body: JSON.stringify({ handle: other.handle }),
    })
    expect(res.status).toBe(409)
    await jsonError(res, 'conflict')
  })
})

describe('PUT /api/settings/avatar', () => {
  test('401 without an Access identity', async () => {
    const { dispatch } = testEnv()
    const form = new FormData()
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }))
    const res = await dispatch('/api/settings/avatar', { method: 'PUT', body: form })
    expect(res.status).toBe(401)
  })

  test('uploads to R2 and records avatar_key', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const form = new FormData()
    form.append('file', new File([bytes], 'avatar.png', { type: 'image/png' }))
    const res = await dispatch('/api/settings/avatar', {
      method: 'PUT',
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }) },
      body: form,
    })
    expect(res.status).toBe(200)
    const body = await jsonShaped(updateAvatarResponseSchema, res)
    expect(body.avatar_url).toBe(`/api/users/${user.handle}/avatar`)

    const stored = await env.BUCKET.get(`avatars/${user.id}`)
    expect(stored).not.toBeNull()
    expect(stored?.httpMetadata?.contentType).toBe('image/png')

    const avatarRes = await dispatch(`/api/users/${user.handle}/avatar`)
    expect(avatarRes.status).toBe(200)
    expect(new Uint8Array(await avatarRes.arrayBuffer())).toEqual(bytes)
  })

  test('400 invalid_content_type for an unsupported type', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    const form = new FormData()
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'a.txt', { type: 'text/plain' }))
    const res = await dispatch('/api/settings/avatar', {
      method: 'PUT',
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }) },
      body: form,
    })
    expect(res.status).toBe(400)
    await jsonError(res, 'invalid_content_type')
  })

  test('413 payload_too_large over 2MB', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    const bytes = new Uint8Array(AVATAR_MAX_BYTES + 1)
    const form = new FormData()
    form.append('file', new File([bytes], 'big.png', { type: 'image/png' }))
    const res = await dispatch('/api/settings/avatar', {
      method: 'PUT',
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }) },
      body: form,
    })
    expect(res.status).toBe(413)
    await jsonError(res, 'payload_too_large')
  })
})

describe('POST /api/settings/tokens', () => {
  test('401 without an Access identity', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/settings/tokens', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  test('issues a token and revokes the previous one', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    const oldToken = await insertAccessToken(env.DB, user)

    const res = await dispatch('/api/settings/tokens', {
      method: 'POST',
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }) },
    })
    expect(res.status).toBe(201)
    const body = await jsonShaped(accessTokenCreatedSchema, res)
    expect(body.revoked_at).toBeNull()
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const db = createDb(env.DB)
    const oldHash = await hashAccessToken(oldToken)
    const oldRow = await db.query.accessTokens.findFirst({
      where: (row, { eq }) => eq(row.tokenHash, oldHash),
    })
    expect(oldRow === undefined ? null : oldRow.revokedAt).not.toBeNull()
  })

  test('leaves exactly one active token, stored only as its hash', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    await insertAccessToken(env.DB, user)
    await insertAccessToken(env.DB, user)

    const res = await dispatch('/api/settings/tokens', {
      method: 'POST',
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }) },
    })
    expect(res.status).toBe(201)
    const body = await jsonShaped(accessTokenCreatedSchema, res)

    const active = await createDb(env.DB).query.accessTokens.findMany({
      where: (row, { and, eq, isNull }) => and(eq(row.userId, user.id), isNull(row.revokedAt)),
    })
    expect(active.map((row) => row.id)).toEqual([body.id])
    expect(active[0]?.tokenHash).toBe(await hashAccessToken(body.token))
  })
})

describe('DELETE /api/settings/tokens', () => {
  test('401 without an Access identity', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/settings/tokens', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })

  test('404 when there is no active token', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    const res = await dispatch('/api/settings/tokens', {
      method: 'DELETE',
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }) },
    })
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('204 revokes the active token', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    await insertAccessToken(env.DB, user)
    const res = await dispatch('/api/settings/tokens', {
      method: 'DELETE',
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }) },
    })
    expect(res.status).toBe(204)

    const again = await dispatch('/api/settings/tokens', {
      method: 'DELETE',
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }) },
    })
    expect(again.status).toBe(404)
  })

  test('204 revokes every active token of the user, and only theirs', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB)
    const other = await insertUser(env.DB)
    await insertAccessToken(env.DB, user)
    await insertAccessToken(env.DB, user)
    await insertAccessToken(env.DB, other)

    const res = await dispatch('/api/settings/tokens', {
      method: 'DELETE',
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }) },
    })
    expect(res.status).toBe(204)

    const db = createDb(env.DB)
    const activeOf = (userId: string) =>
      db.query.accessTokens.findMany({
        where: (row, { and, eq, isNull }) => and(eq(row.userId, userId), isNull(row.revokedAt)),
      })
    expect(await activeOf(user.id)).toEqual([])
    expect(await activeOf(other.id)).toHaveLength(1)
  })
})
