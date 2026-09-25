// Insert/select round trips for every table in src/db/pg/schema.ts, run
// against pglite migrated with the generated src/db/pg/migrations SQL. Only
// meaningful when '#schema' resolves to the postgres schema (`bun run
// test:pg`); skipped otherwise so plain `bun test` still passes.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import { eq } from 'drizzle-orm'
import { DIALECT } from '#schema'
import {
  accessTokens,
  jobs,
  logs,
  mediaAssets,
  metrics,
  projects,
  users,
} from '../../src/db/pg/schema'
import { createPgliteTestDb, type PgliteTestDb } from './helpers/db'

const dialect: string = DIALECT

describe.skipIf(dialect !== 'postgresql')('src/db/pg/schema.ts round trips', () => {
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

  test('users round-trip, including the unique handle/email indexes', async () => {
    const { db } = testDb()
    const createdAt = dayjs('2026-01-01T00:00:00.000Z').toDate()
    await db.insert(users).values({
      id: 'user-1',
      handle: 'ada',
      displayName: 'Ada Lovelace',
      avatarKey: null,
      cfAccessEmail: 'ada@example.com',
      role: 'admin',
      createdAt,
    })
    const [row] = await db.select().from(users).where(eq(users.id, 'user-1'))
    expect(row).toEqual({
      id: 'user-1',
      handle: 'ada',
      displayName: 'Ada Lovelace',
      avatarKey: null,
      cfAccessEmail: 'ada@example.com',
      role: 'admin',
      createdAt,
    })

    // `.rejects` needs a genuine Promise; drizzle's query builders are only
    // thenable (QueryPromise implements, not extends, Promise), so wrap in
    // an async IIFE rather than passing the builder straight to `expect`.
    await expect(
      (async () => {
        await db.insert(users).values({
          id: 'user-2',
          handle: 'ada',
          displayName: 'Duplicate handle',
          avatarKey: null,
          cfAccessEmail: 'someone-else@example.com',
          role: 'user',
          createdAt,
        })
      })(),
    ).rejects.toThrow()
  })

  test('access_tokens round-trip and cascade when the user is deleted', async () => {
    const { db } = testDb()
    const issuedAt = dayjs('2026-01-02T00:00:00.000Z').toDate()
    await db.insert(users).values({
      id: 'user-token-owner',
      handle: 'token-owner',
      displayName: 'Token Owner',
      avatarKey: null,
      cfAccessEmail: 'token-owner@example.com',
      role: 'user',
      createdAt: issuedAt,
    })
    await db.insert(accessTokens).values({
      id: 'token-1',
      userId: 'user-token-owner',
      tokenHash: 'hash-1',
      tokenHint: 'ab..cd',
      issuedAt,
      revokedAt: null,
    })
    const [row] = await db.select().from(accessTokens).where(eq(accessTokens.id, 'token-1'))
    expect(row).toEqual({
      id: 'token-1',
      userId: 'user-token-owner',
      tokenHash: 'hash-1',
      tokenHint: 'ab..cd',
      issuedAt,
      revokedAt: null,
    })

    await db.delete(users).where(eq(users.id, 'user-token-owner'))
    const remaining = await db.select().from(accessTokens).where(eq(accessTokens.id, 'token-1'))
    expect(remaining).toEqual([])
  })

  test('projects and jobs round-trip, jsonb config included', async () => {
    const { db } = testDb()
    const createdAt = dayjs('2026-01-03T00:00:00.000Z').toDate()
    await db.insert(users).values({
      id: 'user-owner',
      handle: 'owner',
      displayName: 'Owner',
      avatarKey: null,
      cfAccessEmail: 'owner@example.com',
      role: 'user',
      createdAt,
    })
    await db.insert(projects).values({
      id: 'project-1',
      name: 'atmos',
      visibility: 'internal',
      ownerId: 'user-owner',
      createdAt,
    })
    const startedAt = dayjs('2026-01-03T01:00:00.000Z').toDate()
    const config = { epochs: 3, tags: ['a', 'b'], nested: { lr: 0.001 } }
    await db.insert(jobs).values({
      id: 'job-1',
      projectId: 'project-1',
      name: 'training run',
      status: 'running',
      config,
      createdBy: 'user-owner',
      startedAt,
      finishedAt: null,
    })
    const [row] = await db.select().from(jobs).where(eq(jobs.id, 'job-1'))
    expect(row).toEqual({
      id: 'job-1',
      projectId: 'project-1',
      name: 'training run',
      status: 'running',
      config,
      createdBy: 'user-owner',
      startedAt,
      finishedAt: null,
    })
  })

  test('timestamps floor to whole seconds like the D1 schema', async () => {
    const { db } = testDb()
    const createdAt = dayjs('2026-01-04T00:00:00.789Z').toDate()
    await db.insert(users).values({
      id: 'user-subsecond',
      handle: 'subsecond',
      displayName: 'Subsecond',
      avatarKey: null,
      cfAccessEmail: 'subsecond@example.com',
      role: 'user',
      createdAt,
    })
    const [row] = await db.select().from(users).where(eq(users.id, 'user-subsecond'))
    expect(row?.createdAt.getTime()).toBe(Math.floor(createdAt.getTime() / 1000) * 1000)
  })

  test('metrics and logs use identity ids and round-trip', async () => {
    const { db } = testDb()
    const createdAt = dayjs('2026-01-05T00:00:00.000Z').toDate()
    await db.insert(users).values({
      id: 'user-for-metrics',
      handle: 'metrics-owner',
      displayName: 'Metrics Owner',
      avatarKey: null,
      cfAccessEmail: 'metrics-owner@example.com',
      role: 'user',
      createdAt,
    })
    await db.insert(projects).values({
      id: 'project-metrics',
      name: 'metrics project',
      visibility: 'public',
      ownerId: 'user-for-metrics',
      createdAt,
    })
    await db.insert(jobs).values({
      id: 'job-metrics',
      projectId: 'project-metrics',
      name: null,
      status: 'finished',
      config: {},
      createdBy: 'user-for-metrics',
      startedAt: createdAt,
      finishedAt: createdAt,
    })

    const insertedMetrics = await db
      .insert(metrics)
      .values({ jobId: 'job-metrics', step: 1, key: 'loss', value: 0.5, loggedAt: createdAt })
      .returning()
    expect(insertedMetrics.length).toBe(1)
    const metric = insertedMetrics[0]
    expect(metric).toBeDefined()
    expect(metric.id).toBeGreaterThan(0)
    const readBack = await db.select().from(metrics).where(eq(metrics.id, metric.id))
    expect(readBack).toEqual(insertedMetrics)

    const insertedLogs = await db
      .insert(logs)
      .values({ jobId: 'job-metrics', stream: 'stdout', message: 'hello', loggedAt: createdAt })
      .returning()
    expect(insertedLogs.length).toBe(1)
    const log = insertedLogs[0]
    expect(log).toBeDefined()
    expect(log.id).toBeGreaterThan(0)

    await db.insert(mediaAssets).values({
      id: 'media-1',
      jobId: 'job-metrics',
      step: 1,
      kind: 'image',
      label: 'sample',
      r2Key: 'jobs/job-metrics/sample.png',
      contentType: 'image/png',
      size: 1024,
      loggedAt: createdAt,
    })
    const [media] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, 'media-1'))
    expect(media).toEqual({
      id: 'media-1',
      jobId: 'job-metrics',
      step: 1,
      kind: 'image',
      label: 'sample',
      r2Key: 'jobs/job-metrics/sample.png',
      contentType: 'image/png',
      size: 1024,
      loggedAt: createdAt,
    })
  })
})
