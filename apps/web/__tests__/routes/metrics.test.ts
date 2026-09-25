// Tests for src/api/routes/metrics.ts against a real D1 + workerd
// (docs/SPEC.md §8), dispatched through __tests__/routes/worker.ts so
// Cf-Access-Jwt-Assertion verification goes through the real JWKS fetch (see
// __tests__/routes/test-env.ts for why this does not reuse
// __tests__/helpers/test-worker.ts).
//
// The ingest route's live broadcast is verified end-to-end: a real WebSocket
// is opened against the live route before ingesting, and the test waits for
// the JobLive Durable Object to relay each message `notifyLive` sent — see
// __tests__/routes/live.test.ts for the same pattern.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { createDb, metrics as metricsTable } from '../../src/db/schema'
import {
  ingestAcceptedResponseSchema,
  liveMessageSchema,
  metricSchema,
  pageSchema,
} from '../../src/shared/schemas'
import { INGEST_METRICS_MAX_ITEMS } from '../../src/shared/types'
import { insertAccessToken, insertJob, insertProject, insertUser } from '../helpers/fixtures'
import { expectShape, jsonError, jsonShaped } from '../helpers/http'
import { createRouteTestEnv, type RouteTestEnv } from './test-env'

const TIMEOUT = 60_000

const metricPageSchema = pageSchema(metricSchema)

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

/** Waits for `received` to gain `count` messages, polling like live.test.ts. */
const waitForMessages = async (
  received: string[],
  count: number,
  remaining = 100,
): Promise<string[]> => {
  if (received.length >= count) {
    return received
  }
  if (remaining === 0) {
    throw new Error('did not receive enough live messages in time')
  }
  await Bun.sleep(20)
  return waitForMessages(received, count, remaining - 1)
}

describe('POST /api/projects/:project_id/jobs/:job_id/metrics', () => {
  test(
    'accepts a batch and broadcasts each metric over notifyLive',
    async () => {
      const { dispatch, env } = testEnv()
      const owner = await insertUser(env.DB)
      const project = await insertProject(env.DB, owner, { visibility: 'public' })
      const job = await insertJob(env.DB, project)
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

      const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/metrics`, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify({
          metrics: [
            { step: 1, key: 'loss', value: 0.5 },
            { step: 2, key: 'loss', value: 0.4, logged_at: '2026-09-24T00:00:00.000Z' },
          ],
        }),
      })
      expect(res.status).toBe(202)
      expect(await jsonShaped(ingestAcceptedResponseSchema, res)).toEqual({ accepted: 2 })

      const messages = await waitForMessages(received, 2)
      const parsed = messages
        .slice(0, 2)
        .map((message) => expectShape(liveMessageSchema, JSON.parse(message)))
      for (const message of parsed) {
        expect(message.type).toBe('metric')
        expect(message.data.job_id).toBe(job.id)
      }
      const second = parsed.find((message) => message.type === 'metric' && message.data.step === 2)
      expect(second).toEqual({
        type: 'metric',
        data: {
          id: expect.any(String),
          job_id: job.id,
          step: 2,
          key: 'loss',
          value: 0.4,
          logged_at: '2026-09-24T00:00:00.000Z',
        },
      })
    },
    TIMEOUT,
  )

  // D1 caps a statement at 100 bound parameters (5 per metric row), so these
  // sizes only succeed when the insert is split into chunks.
  for (const count of [100, INGEST_METRICS_MAX_ITEMS]) {
    test(
      `accepts a batch of ${count} and broadcasts every metric in order`,
      async () => {
        const { dispatch, env } = testEnv()
        const owner = await insertUser(env.DB)
        const project = await insertProject(env.DB, owner, { visibility: 'public' })
        const job = await insertJob(env.DB, project)
        const token = await insertAccessToken(env.DB, owner)

        const liveRes = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/live`, {
          headers: { Upgrade: 'websocket' },
        })
        const ws = liveRes.webSocket
        if (ws === null || ws === undefined) {
          throw new Error('no websocket in the 101 response')
        }
        const received: string[] = []
        ws.addEventListener('message', (event) => {
          received.push(typeof event.data === 'string' ? event.data : '<binary>')
        })
        ws.accept()

        const items = Array.from({ length: count }, (_, index) => ({
          step: index,
          key: 'loss',
          value: index / 10,
        }))
        const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/metrics`, {
          method: 'POST',
          headers: jsonHeaders(token),
          body: JSON.stringify({ metrics: items }),
        })
        expect(res.status).toBe(202)
        expect(await jsonShaped(ingestAcceptedResponseSchema, res)).toEqual({ accepted: count })

        expect(await createDb(env.DB).$count(metricsTable, eq(metricsTable.jobId, job.id))).toBe(
          count,
        )

        const messages = await waitForMessages(received, count, 500)
        const steps = messages.map((message) => JSON.parse(message).data.step)
        expect(steps).toEqual(items.map((item) => item.step))
        ws.close(1000)
      },
      TIMEOUT,
    )
  }

  test('413s over the item limit', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project)
    const token = await insertAccessToken(env.DB, owner)

    const metrics = Array.from({ length: INGEST_METRICS_MAX_ITEMS + 1 }, (_, index) => ({
      step: index,
      key: 'loss',
      value: 1,
    }))
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/metrics`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ metrics }),
    })
    expect(res.status).toBe(413)
    await jsonError(res, 'payload_too_large')
  })

  test('400s on a malformed item', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project)
    const token = await insertAccessToken(env.DB, owner)

    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/metrics`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ metrics: [{ step: 1, key: '', value: 0.1 }] }),
    })
    expect(res.status).toBe(400)
    await jsonError(res, 'validation_error')
  })

  test('404s when project_id and job_id do not belong together', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const projectA = await insertProject(env.DB, owner)
    const projectB = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, projectA)
    const token = await insertAccessToken(env.DB, owner)

    const res = await dispatch(`/api/projects/${projectB.id}/jobs/${job.id}/metrics`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ metrics: [] }),
    })
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('a non-owner token gets 404', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project)
    const stranger = await insertUser(env.DB)
    const strangerToken = await insertAccessToken(env.DB, stranger)

    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/metrics`, {
      method: 'POST',
      headers: jsonHeaders(strangerToken),
      body: JSON.stringify({ metrics: [] }),
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/projects/:project_id/jobs/:job_id/metrics', () => {
  const seed = async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project)
    const token = await insertAccessToken(env.DB, owner)
    await dispatch(`/api/projects/${project.id}/jobs/${job.id}/metrics`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({
        metrics: [
          { step: 1, key: 'loss', value: 1 },
          { step: 2, key: 'loss', value: 0.9 },
          { step: 1, key: 'accuracy', value: 0.5 },
        ],
      }),
    })
    return { project, job }
  }

  test('filters by key', async () => {
    const { dispatch } = testEnv()
    const { project, job } = await seed()
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/metrics?key=accuracy`)
    const body = await jsonShaped(metricPageSchema, res)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]?.key).toBe('accuracy')
  })

  test('filters by since_step', async () => {
    const { dispatch } = testEnv()
    const { project, job } = await seed()
    const res = await dispatch(
      `/api/projects/${project.id}/jobs/${job.id}/metrics?key=loss&since_step=2`,
    )
    const body = await jsonShaped(metricPageSchema, res)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]?.step).toBe(2)
  })

  test('paginates in ascending id order', async () => {
    const { dispatch } = testEnv()
    const { project, job } = await seed()
    const first = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/metrics?limit=2`)
    const firstBody = await jsonShaped(metricPageSchema, first)
    expect(firstBody.items).toHaveLength(2)
    expect(firstBody.next_cursor).not.toBeNull()

    const second = await dispatch(
      `/api/projects/${project.id}/jobs/${job.id}/metrics?limit=2&cursor=${firstBody.next_cursor}`,
    )
    const secondBody = await jsonShaped(metricPageSchema, second)
    expect(secondBody.items).toHaveLength(1)
    expect(secondBody.next_cursor).toBeNull()
  })

  test('a private project requires Access', async () => {
    const { dispatch, env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { visibility: 'private' })
    const job = await insertJob(env.DB, project)

    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/metrics`)
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })
})
