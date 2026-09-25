// Tests for src/api/routes/projects.ts against a real D1 + workerd
// (docs/SPEC.md §6), dispatched through __tests__/routes/worker.ts so
// Cf-Access-Jwt-Assertion verification goes through the real JWKS fetch (see
// __tests__/routes/test-env.ts for why this does not reuse
// __tests__/helpers/test-worker.ts).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { pageSchema, projectSchema } from '../../src/shared/schemas'
import { insertAccessToken, insertProject, insertUser } from '../helpers/fixtures'
import { jsonError, jsonShaped } from '../helpers/http'
import { createRouteTestEnv, type RouteTestEnv } from './test-env'

const TIMEOUT = 60_000

const projectPageSchema = pageSchema(projectSchema)

const t: { current: RouteTestEnv | null } = { current: null }
const testEnv = (): RouteTestEnv => {
  if (t.current === null) {
    throw new Error('test env not started')
  }
  return t.current
}

beforeAll(async () => {
  t.current = await createRouteTestEnv()
}, TIMEOUT)

afterAll(async () => {
  if (t.current !== null) {
    await t.current.dispose()
  }
})

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

describe('GET /api/projects', () => {
  test('lists public projects and hides private ones from an anonymous viewer', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    await insertProject(env.DB, owner, { name: 'public one', visibility: 'public' })
    await insertProject(env.DB, owner, { name: 'private one', visibility: 'private' })

    const res = await dispatch('/api/projects')
    expect(res.status).toBe(200)
    const body = await jsonShaped(projectPageSchema, res)
    const names = body.items.map((p) => p.name)
    expect(names).toContain('public one')
    expect(names).not.toContain('private one')
  })

  test('a signed-in owner also sees their own private projects', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'owner-proj@example.com' })
    await insertProject(env.DB, owner, { name: 'owner public', visibility: 'public' })
    await insertProject(env.DB, owner, { name: 'owner private', visibility: 'private' })
    const stranger = await insertUser(env.DB, { cfAccessEmail: 'stranger-proj@example.com' })
    await insertProject(env.DB, stranger, { name: 'stranger private', visibility: 'private' })

    const res = await dispatch('/api/projects', {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: owner.cfAccessEmail }) },
    })
    const body = await jsonShaped(projectPageSchema, res)
    const names = body.items.map((p) => p.name)
    expect(names).toContain('owner public')
    expect(names).toContain('owner private')
    expect(names).not.toContain('stranger private')
  })

  test('internal projects are hidden from an anonymous viewer, shown to any signed-in registered user', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'internal-owner@example.com' })
    await insertProject(env.DB, owner, { name: 'members only one', visibility: 'internal' })
    const other = await insertUser(env.DB, { cfAccessEmail: 'internal-viewer@example.com' })

    const anon = await dispatch('/api/projects')
    const anonBody = await jsonShaped(projectPageSchema, anon)
    expect(anonBody.items.map((p) => p.name)).not.toContain('members only one')

    const signedIn = await dispatch('/api/projects', {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: other.cfAccessEmail }) },
    })
    const signedInBody = await jsonShaped(projectPageSchema, signedIn)
    expect(signedInBody.items.map((p) => p.name)).toContain('members only one')
  })

  test('an admin sees every project regardless of visibility', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'admin-list-owner@example.com' })
    await insertProject(env.DB, owner, { name: 'admin sees private', visibility: 'private' })
    const admin = await insertUser(env.DB, {
      cfAccessEmail: 'admin-list-viewer@example.com',
      role: 'admin',
    })

    const res = await dispatch('/api/projects', {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }) },
    })
    const body = await jsonShaped(projectPageSchema, res)
    expect(body.items.map((p) => p.name)).toContain('admin sees private')
  })

  test('paginates with next_cursor', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const names = ['page a', 'page b', 'page c'].map((name) => `${name} ${owner.id}`)
    for (const name of names) {
      await insertProject(env.DB, owner, { name, visibility: 'public' })
    }

    const seen: string[] = []
    const collect = async (cursor: string | null): Promise<void> => {
      const query = cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`
      const res = await dispatch(`/api/projects?limit=2${query}`)
      const body = await jsonShaped(projectPageSchema, res)
      seen.push(...body.items.map((p) => p.name))
      if (body.next_cursor !== null) {
        await collect(body.next_cursor)
      }
    }
    await collect(null)

    expect(names.every((name) => seen.includes(name))).toBe(true)
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('GET /api/projects/:project_id', () => {
  test('returns a public project to anyone and keeps a private one from an anonymous viewer', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const shown = await insertProject(env.DB, owner, { name: 'one public', visibility: 'public' })
    const hidden = await insertProject(env.DB, owner, {
      name: 'one private',
      visibility: 'private',
    })

    const res = await dispatch(`/api/projects/${shown.id}`)
    expect(res.status).toBe(200)
    const project = await jsonShaped(projectSchema, res)
    expect(project).toMatchObject({
      id: shown.id,
      name: 'one public',
      visibility: 'public',
      owner: { id: owner.id, handle: owner.handle, display_name: owner.displayName },
    })
    expect(project.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const denied = await dispatch(`/api/projects/${hidden.id}`)
    expect(denied.status).toBe(401)
    await jsonError(denied, 'unauthenticated')

    const missing = await dispatch('/api/projects/no-such-project')
    expect(missing.status).toBe(404)
    await jsonError(missing, 'not_found')
  })

  test('an internal project needs an Access identity, but not ownership', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'internal-detail-owner@example.com' })
    const project = await insertProject(env.DB, owner, {
      name: 'internal detail',
      visibility: 'internal',
    })
    const other = await insertUser(env.DB, { cfAccessEmail: 'internal-detail-viewer@example.com' })

    const anon = await dispatch(`/api/projects/${project.id}`)
    expect(anon.status).toBe(401)
    await jsonError(anon, 'unauthenticated')

    const signedIn = await dispatch(`/api/projects/${project.id}`, {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: other.cfAccessEmail }) },
    })
    expect(signedIn.status).toBe(200)
  })

  test('an admin may view a private project they do not own', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'admin-detail-owner@example.com' })
    const project = await insertProject(env.DB, owner, {
      name: 'admin detail',
      visibility: 'private',
    })
    const admin = await insertUser(env.DB, {
      cfAccessEmail: 'admin-detail-viewer@example.com',
      role: 'admin',
    })

    const res = await dispatch(`/api/projects/${project.id}`, {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }) },
    })
    expect(res.status).toBe(200)
    const body = await jsonShaped(projectSchema, res)
    expect(body.name).toBe('admin detail')
  })
})

describe('POST /api/projects', () => {
  test('requires a Bearer token', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"x"}',
    })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('creates a private-by-default project for the token owner', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const token = await insertAccessToken(env.DB, owner)

    const res = await dispatch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ name: 'my-experiment' }),
    })
    expect(res.status).toBe(201)
    const project = await jsonShaped(projectSchema, res)
    expect(project.name).toBe('my-experiment')
    expect(project.visibility).toBe('private')
    expect(project.owner).toEqual({
      id: owner.id,
      handle: owner.handle,
      display_name: owner.displayName,
    })
  })

  test('get-or-create: a second call with the same name returns the existing project (200)', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const token = await insertAccessToken(env.DB, owner)
    const create = () =>
      dispatch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...bearer(token) },
        body: JSON.stringify({ name: 'shared-name', visibility: 'public' }),
      })

    const first = await create()
    expect(first.status).toBe(201)
    const firstProject = await jsonShaped(projectSchema, first)

    const second = await dispatch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      // visibility is ignored once the project already exists.
      body: JSON.stringify({ name: 'shared-name', visibility: 'private' }),
    })
    expect(second.status).toBe(200)
    const secondProject = await jsonShaped(projectSchema, second)
    expect(secondProject.id).toBe(firstProject.id)
    expect(secondProject.visibility).toBe('public')
  })

  test('rejects an empty name with 400 validation_error', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const token = await insertAccessToken(env.DB, owner)

    const res = await dispatch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
    await jsonError(res, 'validation_error')
  })

  test('rejects a revoked token with 401', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const revoked = await insertAccessToken(env.DB, owner, { revoked: true })

    const res = await dispatch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(revoked) },
      body: JSON.stringify({ name: 'x' }),
    })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('creates a project for a Cloudflare Access user with no Bearer token (web UI)', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'access-create@example.com' })

    const res = await dispatch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: owner.cfAccessEmail }),
      },
      body: JSON.stringify({ name: 'from-the-web-ui', visibility: 'internal' }),
    })
    expect(res.status).toBe(201)
    const project = await jsonShaped(projectSchema, res)
    expect(project.name).toBe('from-the-web-ui')
    expect(project.visibility).toBe('internal')
    expect(project.owner.id).toBe(owner.id)
  })

  test('409 conflict for an Access user creating a second project with the same name', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'access-conflict@example.com' })
    const accessHeader = await access.sign({ email: owner.cfAccessEmail })
    const create = () =>
      dispatch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': accessHeader,
        },
        body: JSON.stringify({ name: 'duplicate-from-ui' }),
      })

    const first = await create()
    expect(first.status).toBe(201)

    const second = await create()
    expect(second.status).toBe(409)
    await jsonError(second, 'conflict')
  })

  test('401 unauthenticated with neither a Bearer token nor an Access identity', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'nobody' }),
    })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('401 unauthenticated for an Access identity that is not a registered user', async () => {
    const { dispatch, access } = testEnv()
    const res = await dispatch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': await access.sign({ email: 'unregistered@example.com' }),
      },
      body: JSON.stringify({ name: 'nobody' }),
    })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })
})
