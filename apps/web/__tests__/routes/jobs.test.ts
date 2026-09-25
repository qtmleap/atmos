// Tests for src/api/routes/jobs.ts against a real D1 + workerd (docs/SPEC.md
// §7), dispatched through __tests__/routes/worker.ts so Cf-Access-Jwt-Assertion
// verification goes through the real JWKS fetch (see __tests__/routes/test-env.ts
// for why this does not reuse __tests__/helpers/test-worker.ts).
//
// The finish route's live broadcast is verified end-to-end: a real WebSocket
// is opened against the live route before the finish call, and the test
// waits for the JobLive Durable Object to relay the message it received from
// `notifyLive` — see __tests__/routes/live.test.ts for the same pattern.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { now } from '../../src/api/lib/ids'
import { createDb, logs, mediaAssets, metrics } from '../../src/db/schema'
import {
  jobSchema,
  liveMessageSchema,
  mediaAssetSchema,
  pageSchema,
} from '../../src/shared/schemas'
import { insertAccessToken, insertJob, insertProject, insertUser } from '../helpers/fixtures'
import { expectShape, jsonError, jsonShaped } from '../helpers/http'
import { createRouteTestEnv, type RouteTestEnv } from './test-env'

const TIMEOUT = 60_000

const jobPageSchema = pageSchema(jobSchema)

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
const jsonHeaders = (token: string) => ({ 'Content-Type': 'application/json', ...bearer(token) })

/** Waits for `received` to gain its first message, polling like live.test.ts. */
const waitForMessage = async (received: string[], remaining = 100): Promise<string> => {
  const first = received[0]
  if (first !== undefined) {
    return first
  }
  if (remaining === 0) {
    throw new Error('no live message received in time')
  }
  await Bun.sleep(20)
  return waitForMessage(received, remaining - 1)
}

describe('POST /api/projects/:project_id/jobs', () => {
  test('creates a running job for the project owner', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const token = await insertAccessToken(env.DB, owner)

    const res = await dispatch(`/api/projects/${project.id}/jobs`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ name: 'run-1', config: { lr: 0.01 } }),
    })
    expect(res.status).toBe(201)
    const job = await jsonShaped(jobSchema, res)
    expect(job.status).toBe('running')
    expect(job.project_id).toBe(project.id)
    expect(job.name).toBe('run-1')
    expect(job.config).toEqual({ lr: 0.01 })
    expect(job.created_by).toBe(owner.id)
    expect(job.finished_at).toBeNull()
    expect(typeof job.started_at).toBe('string')
  })

  test('defaults name to null and config to {}', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const token = await insertAccessToken(env.DB, owner)

    const res = await dispatch(`/api/projects/${project.id}/jobs`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: '{}',
    })
    const job = await jsonShaped(jobSchema, res)
    expect(job.name).toBeNull()
    expect(job.config).toEqual({})
  })

  test('404s for a nonexistent project', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const token = await insertAccessToken(env.DB, owner)

    const res = await dispatch('/api/projects/00000000-0000-4000-8000-000000000000/jobs', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: '{}',
    })
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test("404s when the token owner does not own the project (doesn't leak 403)", async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { visibility: 'public' })
    const stranger = await insertUser(env.DB)
    const strangerToken = await insertAccessToken(env.DB, stranger)

    const res = await dispatch(`/api/projects/${project.id}/jobs`, {
      method: 'POST',
      headers: jsonHeaders(strangerToken),
      body: '{}',
    })
    expect(res.status).toBe(404)
  })

  test('requires a Bearer token', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)

    const res = await dispatch(`/api/projects/${project.id}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })
})

describe('GET /api/projects/:project_id/jobs', () => {
  test('lists jobs and filters by status', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    await insertJob(env.DB, project, { status: 'running' })
    await insertJob(env.DB, project, { status: 'finished' })

    const res = await dispatch(`/api/projects/${project.id}/jobs?status=finished`)
    expect(res.status).toBe(200)
    const body = await jsonShaped(jobPageSchema, res)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]?.status).toBe('finished')
  })

  test('404s for a nonexistent project', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/api/projects/00000000-0000-4000-8000-000000000000/jobs')
    expect(res.status).toBe(404)
  })

  test('a private project requires Access', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { visibility: 'private' })

    const res = await dispatch(`/api/projects/${project.id}/jobs`)
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })
})

describe('GET /api/projects/:project_id/jobs/:job_id', () => {
  test('returns the job', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project, { name: 'exp' })

    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}`)
    expect(res.status).toBe(200)
    expect((await jsonShaped(jobSchema, res)).id).toBe(job.id)
  })

  test('404s when project_id and job_id do not belong together', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const projectA = await insertProject(env.DB, owner)
    const projectB = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, projectA)

    const res = await dispatch(`/api/projects/${projectB.id}/jobs/${job.id}`)
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })
})

describe('POST /api/projects/:project_id/jobs/:job_id/finish', () => {
  test(
    'finishes a running job and broadcasts a status message',
    async () => {
      const { dispatch, env } = testEnv()
      const owner = await insertUser(env.DB)
      const project = await insertProject(env.DB, owner, { visibility: 'public' })
      const job = await insertJob(env.DB, project, { status: 'running' })
      const token = await insertAccessToken(env.DB, owner)

      const liveRes = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/live`, {
        headers: { Upgrade: 'websocket' },
      })
      expect(liveRes.status).toBe(101)
      const ws = liveRes.webSocket
      if (ws === null || ws === undefined) {
        throw new Error('no websocket in the 101 response')
      }
      const received: string[] = []
      ws.addEventListener('message', (event) => {
        received.push(typeof event.data === 'string' ? event.data : '<binary>')
      })
      ws.accept()

      const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/finish`, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify({ status: 'finished' }),
      })
      expect(res.status).toBe(200)
      const updated = await jsonShaped(jobSchema, res)
      expect(updated.status).toBe('finished')
      expect(updated.finished_at).not.toBeNull()

      const message = await waitForMessage(received)
      expect(expectShape(liveMessageSchema, JSON.parse(message))).toEqual({
        type: 'status',
        data: { status: 'finished', finished_at: updated.finished_at },
      })
    },
    TIMEOUT,
  )

  test('double finish is a 409 conflict', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project, {
      status: 'failed',
      finishedAt: now(),
    })
    const token = await insertAccessToken(env.DB, owner)

    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/finish`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ status: 'finished' }),
    })
    expect(res.status).toBe(409)
    await jsonError(res, 'conflict')
  })

  test('a non-owner token gets 404, not 403', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project, { status: 'running' })
    const stranger = await insertUser(env.DB)
    const strangerToken = await insertAccessToken(env.DB, stranger)

    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/finish`, {
      method: 'POST',
      headers: jsonHeaders(strangerToken),
      body: JSON.stringify({ status: 'finished' }),
    })
    expect(res.status).toBe(404)
  })

  test('rejects an invalid status with 400', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project, { status: 'running' })
    const token = await insertAccessToken(env.DB, owner)

    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/finish`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ status: 'running' }),
    })
    expect(res.status).toBe(400)
    await jsonError(res, 'validation_error')
  })
})

describe('PATCH /api/projects/:project_id/jobs/:job_id', () => {
  const patch = (
    dispatch: RouteTestEnv['dispatch'],
    projectId: string,
    jobId: string,
    headers: HeadersInit,
    body: unknown,
  ) =>
    dispatch(`/api/projects/${projectId}/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })

  test('the project owner renames a job, via a Bearer token', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project, { name: 'before' })
    const token = await insertAccessToken(env.DB, owner)

    const res = await patch(dispatch, project.id, job.id, bearer(token), { name: 'after' })
    expect(res.status).toBe(200)
    expect((await jsonShaped(jobSchema, res)).name).toBe('after')
  })

  test('name: null clears the name', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project, { name: 'has-a-name' })
    const token = await insertAccessToken(env.DB, owner)

    const res = await patch(dispatch, project.id, job.id, bearer(token), { name: null })
    expect(res.status).toBe(200)
    expect((await jsonShaped(jobSchema, res)).name).toBeNull()
  })

  test('an admin may rename a job in a project they do not own', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'job-patch-admin-owner@example.com' })
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project, { name: 'before' })
    const admin = await insertUser(env.DB, {
      cfAccessEmail: 'job-patch-admin-viewer@example.com',
      role: 'admin',
    })

    const res = await patch(
      dispatch,
      project.id,
      job.id,
      { 'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }) },
      { name: 'renamed-by-admin' },
    )
    expect(res.status).toBe(200)
    expect((await jsonShaped(jobSchema, res)).name).toBe('renamed-by-admin')
  })

  test('the owner may edit via the CF_Authorization cookie, same-origin only', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'job-patch-cookie-owner@example.com' })
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project, { name: 'before' })
    const cookie = `CF_Authorization=${await access.sign({ email: owner.cfAccessEmail })}`

    const sameOrigin = await dispatch(`/api/projects/${project.id}/jobs/${job.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'Sec-Fetch-Site': 'same-origin',
      },
      body: JSON.stringify({ name: 'cookie-after' }),
    })
    expect(sameOrigin.status).toBe(200)
    expect((await jsonShaped(jobSchema, sameOrigin)).name).toBe('cookie-after')

    const crossSite = await dispatch(`/api/projects/${project.id}/jobs/${job.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'Sec-Fetch-Site': 'cross-site',
      },
      body: JSON.stringify({ name: 'should-not-apply' }),
    })
    expect(crossSite.status).toBe(401)
    await jsonError(crossSite, 'unauthenticated')
  })

  test('403 for a signed-in stranger who can view but not manage the project', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, {
      cfAccessEmail: 'job-patch-stranger-owner@example.com',
    })
    const project = await insertProject(env.DB, owner, { visibility: 'public' })
    const job = await insertJob(env.DB, project)
    const stranger = await insertUser(env.DB, { cfAccessEmail: 'job-patch-stranger@example.com' })

    const res = await patch(
      dispatch,
      project.id,
      job.id,
      { 'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }) },
      { name: 'hijacked' },
    )
    expect(res.status).toBe(403)
    await jsonError(res, 'forbidden')
  })

  test('404 for a signed-in stranger who cannot even view a private project', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'job-patch-hidden-owner@example.com' })
    const project = await insertProject(env.DB, owner, { visibility: 'private' })
    const job = await insertJob(env.DB, project)
    const stranger = await insertUser(env.DB, {
      cfAccessEmail: 'job-patch-hidden-stranger@example.com',
    })

    const res = await patch(
      dispatch,
      project.id,
      job.id,
      { 'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }) },
      { name: 'hijacked' },
    )
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('404 when project_id and job_id do not belong together', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const projectA = await insertProject(env.DB, owner)
    const projectB = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, projectA)
    const token = await insertAccessToken(env.DB, owner)

    const res = await patch(dispatch, projectB.id, job.id, bearer(token), { name: 'x' })
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('401 with neither a Bearer token nor an Access identity', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project)

    const res = await patch(dispatch, project.id, job.id, {}, { name: 'x' })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('400 validation_error for an empty-string name', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project)
    const token = await insertAccessToken(env.DB, owner)

    const res = await patch(dispatch, project.id, job.id, bearer(token), { name: '' })
    expect(res.status).toBe(400)
    await jsonError(res, 'validation_error')
  })
})

describe('DELETE /api/projects/:project_id/jobs/:job_id', () => {
  const del = (
    dispatch: RouteTestEnv['dispatch'],
    projectId: string,
    jobId: string,
    headers: HeadersInit,
  ) => dispatch(`/api/projects/${projectId}/jobs/${jobId}`, { method: 'DELETE', headers })

  test(
    'the owner deletes the job, cascading its metrics/logs/media and their R2 objects',
    async () => {
      const { dispatch, env } = testEnv()
      const owner = await insertUser(env.DB)
      const project = await insertProject(env.DB, owner)
      const job = await insertJob(env.DB, project)
      const otherJob = await insertJob(env.DB, project)
      const token = await insertAccessToken(env.DB, owner)
      const db = createDb(env.DB)

      await db
        .insert(metrics)
        .values({ jobId: job.id, step: 1, key: 'loss', value: 0.1, loggedAt: now() })
      await db
        .insert(logs)
        .values({ jobId: job.id, stream: 'stdout', message: 'hello', loggedAt: now() })
      // A sibling job's data must survive the deletion of `job`.
      await db
        .insert(metrics)
        .values({ jobId: otherJob.id, step: 1, key: 'loss', value: 0.2, loggedAt: now() })

      const form = new FormData()
      form.set(
        'file',
        new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'x.png', { type: 'image/png' }),
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

      const res = await del(dispatch, project.id, job.id, bearer(token))
      expect(res.status).toBe(204)

      expect(await db.$count(metrics, eq(metrics.jobId, job.id))).toBe(0)
      expect(await db.$count(logs, eq(logs.jobId, job.id))).toBe(0)
      expect(await db.$count(mediaAssets, eq(mediaAssets.jobId, job.id))).toBe(0)
      expect(await env.BUCKET.get(r2Key)).toBeNull()
      expect(await db.$count(metrics, eq(metrics.jobId, otherJob.id))).toBe(1)

      const missing = await dispatch(`/api/projects/${project.id}/jobs/${job.id}`)
      expect(missing.status).toBe(404)
    },
    TIMEOUT,
  )

  test('an admin may delete a job in a project they do not own', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'job-del-admin-owner@example.com' })
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project)
    const admin = await insertUser(env.DB, {
      cfAccessEmail: 'job-del-admin-viewer@example.com',
      role: 'admin',
    })

    const res = await del(dispatch, project.id, job.id, {
      'Cf-Access-Jwt-Assertion': await access.sign({ email: admin.cfAccessEmail }),
    })
    expect(res.status).toBe(204)
  })

  test('403 for a signed-in stranger who can view but not manage the project', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'job-del-stranger-owner@example.com' })
    const project = await insertProject(env.DB, owner, { visibility: 'public' })
    const job = await insertJob(env.DB, project)
    const stranger = await insertUser(env.DB, { cfAccessEmail: 'job-del-stranger@example.com' })

    const res = await del(dispatch, project.id, job.id, {
      'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }),
    })
    expect(res.status).toBe(403)
    await jsonError(res, 'forbidden')
  })

  test('404 for a signed-in stranger who cannot even view a private project', async () => {
    const { dispatch, env, access } = testEnv()
    const owner = await insertUser(env.DB, { cfAccessEmail: 'job-del-hidden-owner@example.com' })
    const project = await insertProject(env.DB, owner, { visibility: 'private' })
    const job = await insertJob(env.DB, project)
    const stranger = await insertUser(env.DB, {
      cfAccessEmail: 'job-del-hidden-stranger@example.com',
    })

    const res = await del(dispatch, project.id, job.id, {
      'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }),
    })
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('404 when project_id and job_id do not belong together', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const projectA = await insertProject(env.DB, owner)
    const projectB = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, projectA)
    const token = await insertAccessToken(env.DB, owner)

    const res = await del(dispatch, projectB.id, job.id, bearer(token))
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('401 with neither a Bearer token nor an Access identity', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project)

    const res = await del(dispatch, project.id, job.id, {})
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })
})
