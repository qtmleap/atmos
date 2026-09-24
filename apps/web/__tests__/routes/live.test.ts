// Tests for src/api/routes/live.ts (docs/SPEC.md §11), dispatched through
// __tests__/routes/worker.ts (see __tests__/routes/test-env.ts for why this
// does not reuse __tests__/helpers/test-worker.ts).
//
// checkLiveAccess (the existence + visibility check that runs before the
// Upgrade is handed to connectLive) is exercised two ways:
//   - indirectly, via a plain GET (no `Upgrade` header) to the live route: a
//     failed check surfaces as 404/401/403 before connectLive is ever
//     reached; a passed check reaches the JobLive Durable Object, which
//     replies 426 to a non-Upgrade request — proving the check let it through
//     without needing a real WebSocket.
//   - end-to-end, with a real `Upgrade: websocket` request, confirming the
//     full connectLive hand-off and DO broadcast still work.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { newId } from '../../src/api/lib/ids'
import { insertJob, insertProject, insertUser } from '../helpers/fixtures'
import { jsonError } from '../helpers/http'
import { createRouteTestEnv, type RouteTestEnv } from './test-env'

const TIMEOUT = 60_000

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

describe('GET /api/projects/:project_id/jobs/:job_id/live — pre-Upgrade access check', () => {
  test('404 when project_id does not exist', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch(`/api/projects/${newId()}/jobs/${newId()}/live`)
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('404 when job_id does not exist', async () => {
    const { env, dispatch } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const res = await dispatch(`/api/projects/${project.id}/jobs/${newId()}/live`)
    expect(res.status).toBe(404)
  })

  test('404 when project_id/job_id do not share a parent-child relationship', async () => {
    const { env, dispatch } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const otherProject = await insertProject(env.DB, await insertUser(env.DB))
    const otherJob = await insertJob(env.DB, otherProject)
    const res = await dispatch(`/api/projects/${project.id}/jobs/${otherJob.id}/live`)
    expect(res.status).toBe(404)
  })

  test('426 (reaches the Durable Object) for a public job with no auth', async () => {
    const { env, dispatch } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { visibility: 'public' })
    const job = await insertJob(env.DB, project)
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/live`)
    expect(res.status).toBe(426)
  })

  test('401 for an anonymous viewer of a private job', async () => {
    const { env, dispatch } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { visibility: 'private' })
    const job = await insertJob(env.DB, project)
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/live`)
    expect(res.status).toBe(401)
    expect(res.headers.get('Upgrade')).toBeNull()
    await jsonError(res, 'unauthenticated')
  })

  test('403 for a signed-in non-owner of a private job, 426 for the owner', async () => {
    const { env, dispatch, access } = testEnv()
    const owner = await insertUser(env.DB)
    const stranger = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { visibility: 'private' })
    const job = await insertJob(env.DB, project)

    const forbidden = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/live`, {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }) },
    })
    expect(forbidden.status).toBe(403)
    await jsonError(forbidden, 'forbidden')

    const allowed = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/live`, {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: owner.cfAccessEmail }) },
    })
    expect(allowed.status).toBe(426)
  })
})

describe('GET /api/projects/:project_id/jobs/:job_id/live — end-to-end WebSocket', () => {
  test(
    'upgrades to 101 and relays a message notified through the same job',
    async () => {
      const { env, dispatch } = testEnv()
      const owner = await insertUser(env.DB)
      const project = await insertProject(env.DB, owner, { visibility: 'public' })
      const job = await insertJob(env.DB, project)

      const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/live`, {
        headers: { Upgrade: 'websocket' },
      })
      expect(res.status).toBe(101)
      const ws = res.webSocket
      if (ws === null || ws === undefined) {
        throw new Error('no websocket in the 101 response')
      }
      const received: string[] = []
      ws.addEventListener('message', (event) => {
        received.push(typeof event.data === 'string' ? event.data : '<binary>')
      })
      ws.accept()

      const stub = env.JOB_LIVE.get(env.JOB_LIVE.idFromName(job.id))
      await stub.notify({ type: 'status', data: { job_id: job.id, status: 'succeeded' } })

      const waitFor = async (remaining = 100): Promise<void> => {
        if (received.length > 0) {
          return
        }
        if (remaining === 0) {
          throw new Error('no live message received in time')
        }
        await Bun.sleep(20)
        return waitFor(remaining - 1)
      }
      await waitFor()
      expect(JSON.parse(received[0] === undefined ? 'null' : received[0])).toEqual({
        type: 'status',
        data: { job_id: job.id, status: 'succeeded' },
      })
    },
    TIMEOUT,
  )

  test(
    'a private job rejects the Upgrade for a non-owner instead of opening then closing',
    async () => {
      const { env, dispatch, access } = testEnv()
      const owner = await insertUser(env.DB)
      const stranger = await insertUser(env.DB)
      const project = await insertProject(env.DB, owner, { visibility: 'private' })
      const job = await insertJob(env.DB, project)

      const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/live`, {
        headers: {
          Upgrade: 'websocket',
          'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }),
        },
      })
      expect(res.status).toBe(403)
      expect(res.webSocket === null || res.webSocket === undefined).toBe(true)
    },
    TIMEOUT,
  )
})
