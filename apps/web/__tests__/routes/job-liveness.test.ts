import { afterAll, beforeAll, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import { eq } from 'drizzle-orm'
import { failStaleJobs, JOB_STALE_AFTER_SECONDS } from '../../src/api/lib/job-liveness'
import type { LiveHub } from '../../src/api/platform/types'
import { createDb, jobs } from '../../src/db/schema'
import { jobSchema } from '../../src/shared/schemas'
import { insertAccessToken, insertJob, insertProject, insertUser } from '../helpers/fixtures'
import { createRouteTestEnv, type RouteTestEnv } from './test-env'

const t: { current: RouteTestEnv | null } = { current: null }
const testEnv = (): RouteTestEnv => {
  if (t.current === null) {
    throw new Error('test env not started')
  }
  return t.current
}

beforeAll(async () => {
  t.current = await createRouteTestEnv()
}, 60_000)

afterAll(async () => {
  await t.current?.dispose()
})

test('heartbeat extends a silent running job and rejects finished jobs', async () => {
  const { env, dispatch } = testEnv()
  const owner = await insertUser(env.DB)
  const project = await insertProject(env.DB, owner)
  const token = await insertAccessToken(env.DB, owner)
  const old = dayjs('2026-01-01T00:00:00Z').toDate()
  const job = await insertJob(env.DB, project, { lastActivityAt: old })
  const path = `/api/projects/${project.id}/jobs/${job.id}/heartbeat`
  const request = { method: 'POST', headers: { Authorization: `Bearer ${token}` } }

  expect((await dispatch(path, request)).status).toBe(204)
  const updated = await createDb(env.DB).query.jobs.findFirst({ where: eq(jobs.id, job.id) })
  expect(updated?.lastActivityAt.getTime()).toBeGreaterThan(old.getTime())

  await createDb(env.DB).update(jobs).set({ status: 'finished' }).where(eq(jobs.id, job.id))
  expect((await dispatch(path, request)).status).toBe(404)
})

test('a per-job alarm fails a disconnected training run', async () => {
  const { env, dispatch } = testEnv()
  const owner = await insertUser(env.DB)
  const project = await insertProject(env.DB, owner)
  const token = await insertAccessToken(env.DB, owner)
  const path = `/api/projects/${project.id}/jobs`
  const created = await dispatch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  expect(created.status).toBe(201)
  const job = jobSchema.parse(await created.json())
  const stub = env.JOB_LIVE.get(env.JOB_LIVE.idFromName(job.id))
  await stub.checkLease()
  expect(
    (await createDb(env.DB).query.jobs.findFirst({ where: eq(jobs.id, job.id) }))?.status,
  ).toBe('running')
  await createDb(env.DB)
    .update(jobs)
    .set({
      lastActivityAt: dayjs()
        .subtract(JOB_STALE_AFTER_SECONDS + 10, 'second')
        .toDate(),
    })
    .where(eq(jobs.id, job.id))

  await stub.checkLease()
  const updated = await createDb(env.DB).query.jobs.findFirst({ where: eq(jobs.id, job.id) })
  expect(updated?.status).toBe('failed')
  expect(updated?.finishedAt).not.toBeNull()
})

test('stale jobs fail while recent and completed jobs remain unchanged', async () => {
  const { env } = testEnv()
  const owner = await insertUser(env.DB)
  const project = await insertProject(env.DB, owner)
  const currentTime = dayjs().add(60, 'second').toDate()
  const staleAt = dayjs(currentTime)
    .subtract(JOB_STALE_AFTER_SECONDS + 10, 'second')
    .toDate()
  const freshAt = dayjs(currentTime).subtract(20, 'second').toDate()
  const stale = await insertJob(env.DB, project, { lastActivityAt: staleAt })
  const fresh = await insertJob(env.DB, project, { lastActivityAt: freshAt })
  const completed = await insertJob(env.DB, project, {
    lastActivityAt: staleAt,
    status: 'finished',
  })
  const notifications: { jobId: string; status: string }[] = []
  const live: LiveHub = {
    notify: async (jobId, message) => {
      if (message.type === 'status') {
        notifications.push({ jobId, status: message.data.status })
      }
      return { delivered: 1 }
    },
    notifyMany: async () => ({ delivered: 0 }),
    connect: async () => new Response(),
  }

  await failStaleJobs(createDb(env.DB), live, currentTime)
  const rows = await createDb(env.DB).select().from(jobs)
  expect(rows.find((row) => row.id === stale.id)?.status).toBe('failed')
  expect(rows.find((row) => row.id === stale.id)?.finishedAt).not.toBeNull()
  expect(rows.find((row) => row.id === fresh.id)?.status).toBe('running')
  expect(rows.find((row) => row.id === completed.id)?.status).toBe('finished')
  expect(notifications).toContainEqual({ jobId: stale.id, status: 'failed' })
})
