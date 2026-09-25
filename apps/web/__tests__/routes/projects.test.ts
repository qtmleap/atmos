// Tests for src/api/routes/projects.ts against a real D1 + workerd
// (docs/SPEC.md §6), dispatched through __tests__/routes/worker.ts so
// Cf-Access-Jwt-Assertion verification goes through the real JWKS fetch (see
// __tests__/routes/test-env.ts for why this does not reuse
// __tests__/helpers/test-worker.ts).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { now } from '../../src/api/lib/ids'
import { createDb, jobs, logs, mediaAssets, metrics } from '../../src/db/schema'
import { mediaAssetSchema, pageSchema, projectSchema } from '../../src/shared/schemas'
import { insertAccessToken, insertJob, insertProject, insertUser } from '../helpers/fixtures'
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

describe('PATCH /api/projects/:project_id', () => {
  const patch = (
    dispatch: RouteTestEnv['dispatch'],
    id: string,
    headers: HeadersInit,
    body: unknown,
  ) =>
    dispatch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })

  test('the owner may rename and change visibility, via a Bearer token', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { name: 'before', visibility: 'private' })
    const token = await insertAccessToken(env.DB, owner)

    const res = await patch(dispatch, project.id, bearer(token), {
      name: 'after',
      visibility: 'public',
    })
    expect(res.status).toBe(200)
    const body = await jsonShaped(projectSchema, res)
    expect(body.name).toBe('after')
    expect(body.visibility).toBe('public')
  })

  test('an admin may edit a project they do not own', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'patch-admin-owner@example.com' })
    const project = await insertProject(env.DB, owner, { name: 'admin-target' })
    const admin = await insertUser(env.DB, {
      cfAccessEmail: 'patch-admin-viewer@example.com',
      role: 'admin',
    })

    const res = await patch(
      dispatch,
      project.id,
      { 'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }) },
      { name: 'renamed-by-admin' },
    )
    expect(res.status).toBe(200)
    expect((await jsonShaped(projectSchema, res)).name).toBe('renamed-by-admin')
  })

  test('403 for a signed-in stranger who can view but not manage the project', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'patch-stranger-owner@example.com' })
    const project = await insertProject(env.DB, owner, { visibility: 'public' })
    const stranger = await insertUser(env.DB, { cfAccessEmail: 'patch-stranger@example.com' })

    const res = await patch(
      dispatch,
      project.id,
      { 'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }) },
      { name: 'hijacked' },
    )
    expect(res.status).toBe(403)
    await jsonError(res, 'forbidden')
  })

  test('404 for a signed-in stranger who cannot even view a private project', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'patch-hidden-owner@example.com' })
    const project = await insertProject(env.DB, owner, { visibility: 'private' })
    const stranger = await insertUser(env.DB, {
      cfAccessEmail: 'patch-hidden-stranger@example.com',
    })

    const res = await patch(
      dispatch,
      project.id,
      { 'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }) },
      { name: 'hijacked' },
    )
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('404 for a nonexistent project', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const token = await insertAccessToken(env.DB, owner)

    const res = await patch(dispatch, '00000000-0000-4000-8000-000000000000', bearer(token), {
      name: 'x',
    })
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('401 with neither a Bearer token nor an Access identity', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)

    const res = await patch(dispatch, project.id, {}, { name: 'x' })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('400 validation_error when neither name nor visibility is given', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const token = await insertAccessToken(env.DB, owner)

    const res = await patch(dispatch, project.id, bearer(token), {})
    expect(res.status).toBe(400)
    await jsonError(res, 'validation_error')
  })

  test('409 conflict when renaming to a name the same owner already uses', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    await insertProject(env.DB, owner, { name: 'taken' })
    const project = await insertProject(env.DB, owner, { name: 'to-rename' })
    const token = await insertAccessToken(env.DB, owner)

    const res = await patch(dispatch, project.id, bearer(token), { name: 'taken' })
    expect(res.status).toBe(409)
    await jsonError(res, 'conflict')
  })

  test('renaming to its own current name is not a conflict', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { name: 'same-name', visibility: 'private' })
    const token = await insertAccessToken(env.DB, owner)

    const res = await patch(dispatch, project.id, bearer(token), {
      name: 'same-name',
      visibility: 'public',
    })
    expect(res.status).toBe(200)
    expect((await jsonShaped(projectSchema, res)).visibility).toBe('public')
  })
})

describe('DELETE /api/projects/:project_id', () => {
  const del = (dispatch: RouteTestEnv['dispatch'], id: string, headers: HeadersInit) =>
    dispatch(`/api/projects/${id}`, { method: 'DELETE', headers })

  test(
    'the owner deletes the project, cascading its jobs/metrics/logs/media and their R2 objects',
    async () => {
      const { dispatch, env } = testEnv()
      const owner = await insertUser(env.DB)
      const project = await insertProject(env.DB, owner)
      const job = await insertJob(env.DB, project)
      const token = await insertAccessToken(env.DB, owner)
      const db = createDb(env.DB)

      await db
        .insert(metrics)
        .values({ jobId: job.id, step: 1, key: 'loss', value: 0.1, loggedAt: now() })
      await db
        .insert(logs)
        .values({ jobId: job.id, stream: 'stdout', message: 'hello', loggedAt: now() })

      const form = new FormData()
      form.set(
        'file',
        new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'x.png', {
          type: 'image/png',
        }),
      )
      form.set('kind', 'image')
      form.set('step', '1')
      form.set('label', 'sample')
      const uploadRes = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
        method: 'POST',
        headers: bearer(token),
        body: form,
      })
      expect(uploadRes.status).toBe(201)
      const asset = await jsonShaped(mediaAssetSchema, uploadRes)
      const r2Key = `media/${job.id}/${asset.id}`
      expect(await env.BUCKET.get(r2Key)).not.toBeNull()

      const res = await del(dispatch, project.id, bearer(token))
      expect(res.status).toBe(204)

      expect(await db.$count(jobs, eq(jobs.projectId, project.id))).toBe(0)
      expect(await db.$count(metrics, eq(metrics.jobId, job.id))).toBe(0)
      expect(await db.$count(logs, eq(logs.jobId, job.id))).toBe(0)
      expect(await db.$count(mediaAssets, eq(mediaAssets.jobId, job.id))).toBe(0)
      expect(await env.BUCKET.get(r2Key)).toBeNull()

      const missing = await dispatch(`/api/projects/${project.id}`)
      expect(missing.status).toBe(404)
    },
    TIMEOUT,
  )

  test('an admin may delete a project they do not own', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'del-admin-owner@example.com' })
    const project = await insertProject(env.DB, owner)
    const admin = await insertUser(env.DB, {
      cfAccessEmail: 'del-admin-viewer@example.com',
      role: 'admin',
    })

    const res = await del(dispatch, project.id, {
      'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }),
    })
    expect(res.status).toBe(204)
  })

  test('403 for a signed-in stranger who can view but not manage the project', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'del-stranger-owner@example.com' })
    const project = await insertProject(env.DB, owner, { visibility: 'public' })
    const stranger = await insertUser(env.DB, { cfAccessEmail: 'del-stranger@example.com' })

    const res = await del(dispatch, project.id, {
      'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }),
    })
    expect(res.status).toBe(403)
    await jsonError(res, 'forbidden')
  })

  test('404 for a signed-in stranger who cannot even view a private project', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'del-hidden-owner@example.com' })
    const project = await insertProject(env.DB, owner, { visibility: 'private' })
    const stranger = await insertUser(env.DB, { cfAccessEmail: 'del-hidden-stranger@example.com' })

    const res = await del(dispatch, project.id, {
      'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }),
    })
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('404 for a nonexistent project', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const token = await insertAccessToken(env.DB, owner)

    const res = await del(dispatch, '00000000-0000-4000-8000-000000000000', bearer(token))
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('401 with neither a Bearer token nor an Access identity', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)

    const res = await del(dispatch, project.id, {})
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })
})
