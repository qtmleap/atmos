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
import { now } from '../../src/api/lib/ids'
import { jobSchema, liveMessageSchema, pageSchema } from '../../src/shared/schemas'
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
