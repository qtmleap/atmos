// `pgBatch` (src/db/pg/client.ts) runs a batch of statements inside one
// `raw.transaction(...)`, exactly like `raw.transaction` on the pglite
// instance built here — pglite has no postgres:// endpoint for
// `createPgDatabase` itself to dial, so this exercises the same transaction
// primitive pgBatch relies on directly, against the real pg schema and
// migration SQL, to confirm a mid-batch failure rolls everything back.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import { eq } from 'drizzle-orm'
import { DIALECT } from '#schema'
import { jobs, projects, users } from '../../src/db/pg/schema'
import { createPgliteTestDb, type PgliteTestDb } from './helpers/db'

const dialect: string = DIALECT

describe.skipIf(dialect !== 'postgresql')('postgres transaction rollback', () => {
  const t: { current: PgliteTestDb | null } = { current: null }
  const testDb = (): PgliteTestDb => {
    if (t.current === null) {
      throw new Error('test db not started')
    }
    return t.current
  }

  beforeAll(async () => {
    t.current = await createPgliteTestDb()
  })

  afterAll(async () => {
    if (t.current !== null) {
      await t.current.close()
    }
  })

  test('a later statement failing rolls back the earlier statements in the same batch', async () => {
    const { db, raw } = testDb()
    const createdAt = dayjs('2026-02-01T00:00:00.000Z').toDate()
    await db.insert(users).values({
      id: 'batch-owner',
      handle: 'batch-owner',
      displayName: 'Batch Owner',
      avatarKey: null,
      cfAccessEmail: 'batch-owner@example.com',
      role: 'user',
      createdAt,
    })

    await expect(
      raw.transaction(async (tx) => {
        await tx.insert(projects).values({
          id: 'batch-project',
          name: 'rolled back',
          visibility: 'public',
          ownerId: 'batch-owner',
          createdAt,
        })
        // References a project that does not exist inside this transaction
        // yet (violates the fk), so the whole batch must roll back,
        // including the project insert above.
        await tx.insert(jobs).values({
          id: 'batch-job',
          projectId: 'does-not-exist',
          name: null,
          status: 'running',
          config: {},
          createdBy: 'batch-owner',
          startedAt: createdAt,
          finishedAt: null,
        })
      }),
    ).rejects.toThrow()

    const projectRows = await db.select().from(projects).where(eq(projects.id, 'batch-project'))
    expect(projectRows).toEqual([])
  })

  test('a batch that fully succeeds commits every statement', async () => {
    const { db, raw } = testDb()
    const createdAt = dayjs('2026-02-02T00:00:00.000Z').toDate()
    await db.insert(users).values({
      id: 'batch-owner-2',
      handle: 'batch-owner-2',
      displayName: 'Batch Owner 2',
      avatarKey: null,
      cfAccessEmail: 'batch-owner-2@example.com',
      role: 'user',
      createdAt,
    })

    await raw.transaction(async (tx) => {
      await tx.insert(projects).values({
        id: 'batch-project-2',
        name: 'committed',
        visibility: 'public',
        ownerId: 'batch-owner-2',
        createdAt,
      })
      await tx.insert(jobs).values({
        id: 'batch-job-2',
        projectId: 'batch-project-2',
        name: null,
        status: 'running',
        config: {},
        createdBy: 'batch-owner-2',
        startedAt: createdAt,
        finishedAt: null,
      })
    })

    const projectRows = await db.select().from(projects).where(eq(projects.id, 'batch-project-2'))
    const jobRows = await db.select().from(jobs).where(eq(jobs.id, 'batch-job-2'))
    expect(projectRows.length).toBe(1)
    expect(jobRows.length).toBe(1)
  })
})
