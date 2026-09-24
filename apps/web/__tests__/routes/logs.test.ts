// Tests for src/api/routes/logs.ts (docs/SPEC.md §10) against real D1/the
// JobLive Durable Object, dispatched through __tests__/routes/worker.ts (see
// __tests__/routes/test-env.ts for why this does not reuse
// __tests__/helpers/test-worker.ts).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { newId } from '../../src/api/lib/ids'
import { createDb, logs as logsTable } from '../../src/db/schema'
import {
  ingestAcceptedResponseSchema,
  liveMessageSchema,
  logLineSchema,
  pageSchema,
} from '../../src/shared/schemas'
import { insertAccessToken, insertJob, insertProject, insertUser } from '../helpers/fixtures'
import { expectShape, jsonError, jsonShaped } from '../helpers/http'
import { createRouteTestEnv, type RouteTestEnv } from './test-env'

const TIMEOUT = 60_000

const logPageSchema = pageSchema(logLineSchema)

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

const setup = async () => {
  const { env } = testEnv()
  const owner = await insertUser(env.DB)
  const other = await insertUser(env.DB)
  const project = await insertProject(env.DB, owner)
  const job = await insertJob(env.DB, project)
  const token = await insertAccessToken(env.DB, owner)
  const otherToken = await insertAccessToken(env.DB, other)
  return { env, owner, other, project, job, token, otherToken }
}

const ingest = (
  dispatch: RouteTestEnv['dispatch'],
  projectId: string,
  jobId: string,
  token: string,
  lines: Array<{ stream: 'stdout' | 'stderr'; message: string; logged_at?: string }>,
) =>
  dispatch(`/api/projects/${projectId}/jobs/${jobId}/logs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ logs: lines }),
  })

describe('POST /api/projects/:project_id/jobs/:job_id/logs', () => {
  test('ingests a batch and broadcasts each line over the live channel', async () => {
    const { dispatch } = testEnv()
    const { project, job, token } = await setup()

    const socketRes = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/live`, {
      headers: { Upgrade: 'websocket' },
    })
    expect(socketRes.status).toBe(101)
    const ws = socketRes.webSocket
    if (ws === null || ws === undefined) {
      throw new Error('no websocket in the 101 response')
    }
    const received: string[] = []
    ws.addEventListener('message', (event) => {
      received.push(typeof event.data === 'string' ? event.data : '<binary>')
    })
    ws.accept()

    const res = await ingest(dispatch, project.id, job.id, token, [
      { stream: 'stdout', message: 'hello' },
      { stream: 'stderr', message: 'oops' },
    ])
    expect(res.status).toBe(202)
    expect(await jsonShaped(ingestAcceptedResponseSchema, res)).toEqual({ accepted: 2 })

    const waitFor = async (remaining = 100): Promise<void> => {
      if (received.length >= 2) {
        return
      }
      if (remaining === 0) {
        throw new Error('did not receive 2 live log messages in time')
      }
      await Bun.sleep(20)
      return waitFor(remaining - 1)
    }
    await waitFor()
    const messages = received.map((raw) => expectShape(liveMessageSchema, JSON.parse(raw)))
    expect(messages.every((message) => message.type === 'log')).toBe(true)
    expect(
      messages.map((message) => (message.type === 'log' ? message.data.message : message.type)),
    ).toEqual(['hello', 'oops'])
    ws.close(1000)
  })

  // D1 caps a statement at 100 bound parameters (4 per log row), so these
  // sizes only succeed when the insert is split into chunks.
  for (const count of [100, 1000]) {
    test(
      `ingests a batch of ${count} lines and broadcasts every line in order`,
      async () => {
        const { dispatch } = testEnv()
        const { env, project, job, token } = await setup()

        const socketRes = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/live`, {
          headers: { Upgrade: 'websocket' },
        })
        const ws = socketRes.webSocket
        if (ws === null || ws === undefined) {
          throw new Error('no websocket in the 101 response')
        }
        const received: string[] = []
        ws.addEventListener('message', (event) => {
          received.push(typeof event.data === 'string' ? event.data : '<binary>')
        })
        ws.accept()

        const lines = Array.from({ length: count }, (_, index) => ({
          stream: index % 2 === 0 ? ('stdout' as const) : ('stderr' as const),
          message: `line ${index}`,
        }))
        const res = await ingest(dispatch, project.id, job.id, token, lines)
        expect(res.status).toBe(202)
        expect(await jsonShaped(ingestAcceptedResponseSchema, res)).toEqual({ accepted: count })

        expect(await createDb(env.DB).$count(logsTable, eq(logsTable.jobId, job.id))).toBe(count)

        const waitFor = async (remaining = 500): Promise<void> => {
          if (received.length >= count) {
            return
          }
          if (remaining === 0) {
            throw new Error(`did not receive ${count} live log messages in time`)
          }
          await Bun.sleep(20)
          return waitFor(remaining - 1)
        }
        await waitFor()
        expect(received.map((raw) => JSON.parse(raw).data.message)).toEqual(
          lines.map((line) => line.message),
        )
        ws.close(1000)
      },
      TIMEOUT,
    )
  }

  test('202 { accepted: 0 } for an empty batch', async () => {
    const { dispatch } = testEnv()
    const { project, job, token } = await setup()
    const res = await ingest(dispatch, project.id, job.id, token, [])
    expect(res.status).toBe(202)
    expect(await jsonShaped(ingestAcceptedResponseSchema, res)).toEqual({ accepted: 0 })
  })

  test('401 without a Bearer token', async () => {
    const { dispatch } = testEnv()
    const { project, job } = await setup()
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: [{ stream: 'stdout', message: 'x' }] }),
    })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('404 when the Bearer token does not own the project (permission hidden as not_found)', async () => {
    const { dispatch } = testEnv()
    const { project, job, otherToken } = await setup()
    const res = await ingest(dispatch, project.id, job.id, otherToken, [
      { stream: 'stdout', message: 'x' },
    ])
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('404 when project_id/job_id do not share a parent-child relationship', async () => {
    const { env, dispatch } = testEnv()
    const { project, token } = await setup()
    const otherProject = await insertProject(env.DB, await insertUser(env.DB))
    const otherJob = await insertJob(env.DB, otherProject)
    const res = await ingest(dispatch, project.id, otherJob.id, token, [
      { stream: 'stdout', message: 'x' },
    ])
    expect(res.status).toBe(404)
  })

  test('400 validation_error for an invalid stream value', async () => {
    const { dispatch } = testEnv()
    const { project, job, token } = await setup()
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/logs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: [{ stream: 'bogus', message: 'x' }] }),
    })
    expect(res.status).toBe(400)
    await jsonError(res, 'validation_error')
  })

  test(
    '413 payload_too_large over 1000 lines',
    async () => {
      const { dispatch } = testEnv()
      const { project, job, token } = await setup()
      const lines = Array.from({ length: 1001 }, () => ({
        stream: 'stdout' as const,
        message: 'x',
      }))
      const res = await ingest(dispatch, project.id, job.id, token, lines)
      expect(res.status).toBe(413)
      await jsonError(res, 'payload_too_large')
    },
    TIMEOUT,
  )
})

describe('GET /api/projects/:project_id/jobs/:job_id/logs', () => {
  test('tail (no cursor) returns the most recent lines oldest-first with a next_cursor', async () => {
    const { dispatch } = testEnv()
    const { project, job, token } = await setup()
    const messages = ['a', 'b', 'c', 'd', 'e']
    const res = await ingest(
      dispatch,
      project.id,
      job.id,
      token,
      messages.map((message) => ({ stream: 'stdout' as const, message })),
    )
    expect(res.status).toBe(202)

    const tail = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/logs?limit=3`)
    expect(tail.status).toBe(200)
    const tailBody = await jsonShaped(logPageSchema, tail)
    expect(tailBody.items.map((item) => item.message)).toEqual(['c', 'd', 'e'])
    expect(tailBody.next_cursor).not.toBeNull()

    const before = await dispatch(
      `/api/projects/${project.id}/jobs/${job.id}/logs?limit=3&before=${encodeURIComponent(tailBody.next_cursor === null ? '' : tailBody.next_cursor)}`,
    )
    expect(before.status).toBe(200)
    const beforeBody = await jsonShaped(logPageSchema, before)
    expect(beforeBody.items.map((item) => item.message)).toEqual(['a', 'b'])
    expect(beforeBody.next_cursor).toBeNull()
  })

  test('after cursor pages forward, ascending', async () => {
    const { dispatch } = testEnv()
    const { project, job, token } = await setup()
    const messages = ['a', 'b', 'c', 'd']
    const res = await ingest(
      dispatch,
      project.id,
      job.id,
      token,
      messages.map((message) => ({ stream: 'stdout' as const, message })),
    )
    const inserted = await jsonShaped(ingestAcceptedResponseSchema, res)
    expect(inserted.accepted).toBe(4)

    // ids are a global autoincrement (shared across jobs/tests), so "the start
    // of this job's log" is `(first item's id) - 1`, not a fixed literal.
    const all = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/logs?limit=10`)
    const allBody = await jsonShaped(logPageSchema, all)
    expect(allBody.items.map((item) => item.message)).toEqual(messages)
    const firstItem = allBody.items[0]
    if (firstItem === undefined) {
      throw new Error('expected at least one log line')
    }
    const beforeStart = (Number(firstItem.id) - 1).toString(10)

    const fromStart = await dispatch(
      `/api/projects/${project.id}/jobs/${job.id}/logs?limit=2&after=${beforeStart}`,
    )
    const fromStartBody = await jsonShaped(logPageSchema, fromStart)
    expect(fromStartBody.items.map((item) => item.message)).toEqual(['a', 'b'])
    expect(fromStartBody.next_cursor).not.toBeNull()

    const nextPage = await dispatch(
      `/api/projects/${project.id}/jobs/${job.id}/logs?limit=2&after=${encodeURIComponent(fromStartBody.next_cursor === null ? '' : fromStartBody.next_cursor)}`,
    )
    const nextBody = await jsonShaped(logPageSchema, nextPage)
    expect(nextBody.items.map((item) => item.message)).toEqual(['c', 'd'])
    expect(nextBody.next_cursor).toBeNull()
  })

  test('401 for an anonymous viewer of a private project, 403 for a non-owner, 200 for the owner', async () => {
    const { env, dispatch, access } = testEnv()
    const owner = await insertUser(env.DB)
    const stranger = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { visibility: 'private' })
    const job = await insertJob(env.DB, project)

    const anon = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/logs`)
    expect(anon.status).toBe(401)
    await jsonError(anon, 'unauthenticated')

    const forbidden = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/logs`, {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }) },
    })
    expect(forbidden.status).toBe(403)
    await jsonError(forbidden, 'forbidden')

    const allowed = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/logs`, {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: owner.cfAccessEmail }) },
    })
    expect(allowed.status).toBe(200)
  })

  test('404 when project_id/job_id do not share a parent-child relationship', async () => {
    const { env, dispatch } = testEnv()
    const { project } = await setup()
    const otherProject = await insertProject(env.DB, await insertUser(env.DB))
    const otherJob = await insertJob(env.DB, otherProject)
    const res = await dispatch(`/api/projects/${project.id}/jobs/${otherJob.id}/logs`)
    expect(res.status).toBe(404)
  })

  test('404 when project_id does not exist', async () => {
    const { dispatch } = testEnv()
    const { job } = await setup()
    const res = await dispatch(`/api/projects/${newId()}/jobs/${job.id}/logs`)
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })
})
