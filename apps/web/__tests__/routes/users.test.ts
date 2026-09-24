// docs/SPEC.md §4 — Users: directory, profile, their projects, avatar, /me.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  pageSchema,
  projectSchema,
  userSchema,
  userWithEmailSchema,
} from '../../src/shared/schemas'
import { insertProject, insertUser } from '../helpers/fixtures'
import { expectShape, jsonError, jsonOf, jsonShaped } from '../helpers/http'
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

describe('GET /api/users', () => {
  test('401 without an Access identity', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/users')
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('lists users without their email, for any signed-in viewer', async () => {
    const { access, dispatch, env } = testEnv()
    const viewer = await insertUser(env.DB)
    const res = await dispatch('/api/users', {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: viewer.cfAccessEmail }) },
    })
    expect(res.status).toBe(200)
    const body = await jsonShaped(pageSchema(userSchema), res)
    expect(body.items.some((u) => u.handle === viewer.handle)).toBe(true)
    for (const item of body.items) {
      expect(userWithEmailSchema.safeParse(item).success).toBe(false)
    }
  })
})

describe('GET /api/users/:handle', () => {
  test('needs no auth and omits email', async () => {
    const { dispatch, env } = testEnv()
    const alice = await insertUser(env.DB, { handle: 'alice-pub', displayName: 'Alice' })
    const res = await dispatch(`/api/users/${alice.handle}`)
    expect(res.status).toBe(200)
    const raw = await jsonOf(res)
    const body = expectShape(userSchema, raw)
    expect(body).toMatchObject({ handle: 'alice-pub', display_name: 'Alice' })
    expect(userWithEmailSchema.safeParse(raw).success).toBe(false)
  })

  test('404 for an unknown handle', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/users/does-not-exist-xyz')
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })
})

describe('GET /api/users/:handle/projects', () => {
  test('excludes private projects from an anonymous or other viewer', async () => {
    const { access, dispatch, env } = testEnv()
    const owner = await insertUser(env.DB, { handle: 'owner-with-projects' })
    const stranger = await insertUser(env.DB)
    await insertProject(env.DB, owner, { name: 'public one', visibility: 'public' })
    await insertProject(env.DB, owner, { name: 'secret one', visibility: 'private' })

    const anon = await dispatch(`/api/users/${owner.handle}/projects`)
    const anonBody = await jsonShaped(pageSchema(projectSchema), anon)
    expect(anonBody.items.map((p) => p.name)).toEqual(['public one'])

    const asStranger = await dispatch(`/api/users/${owner.handle}/projects`, {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }) },
    })
    const strangerBody = await jsonShaped(pageSchema(projectSchema), asStranger)
    expect(strangerBody.items.map((p) => p.name)).toEqual(['public one'])
  })

  test('includes private projects for the owner themself', async () => {
    const { access, dispatch, env } = testEnv()
    const owner = await insertUser(env.DB, { handle: 'owner-sees-own' })
    await insertProject(env.DB, owner, { name: 'mine', visibility: 'private' })

    const res = await dispatch(`/api/users/${owner.handle}/projects`, {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: owner.cfAccessEmail }) },
    })
    const body = await jsonShaped(pageSchema(projectSchema), res)
    expect(body.items.map((p) => p.name)).toContain('mine')
  })

  test('404 for an unknown handle', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/users/does-not-exist-xyz/projects')
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })
})

describe('GET /api/users/:handle/avatar', () => {
  test('404 when avatar_key is unset', async () => {
    const { dispatch, env } = testEnv()
    const user = await insertUser(env.DB, { handle: 'no-avatar-user' })
    const res = await dispatch(`/api/users/${user.handle}/avatar`)
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('streams the stored bytes with the stored content type', async () => {
    const { dispatch, env } = testEnv()
    const user = await insertUser(env.DB, {
      handle: 'has-avatar-user',
      avatarKey: 'avatars/has-avatar-user',
    })
    const bytes = new Uint8Array([137, 80, 78, 71])
    await env.BUCKET.put('avatars/has-avatar-user', bytes, {
      httpMetadata: { contentType: 'image/png' },
    })
    const res = await dispatch(`/api/users/${user.handle}/avatar`)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
  })
})

describe('GET /api/me', () => {
  test('401 without an Access identity', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/me')
    expect(res.status).toBe(401)
  })

  test('returns the caller with their email', async () => {
    const { access, dispatch, env } = testEnv()
    const user = await insertUser(env.DB, { handle: 'me-user' })
    const res = await dispatch('/api/me', {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: user.cfAccessEmail }) },
    })
    expect(res.status).toBe(200)
    expect(await jsonShaped(userWithEmailSchema, res)).toMatchObject({
      handle: 'me-user',
      cf_access_email: user.cfAccessEmail,
    })
  })
})
