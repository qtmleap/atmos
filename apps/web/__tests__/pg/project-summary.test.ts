import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import { DIALECT } from '#schema'
import { loadProjectSummaries } from '../../src/api/lib/project-summary'
import { toProject } from '../../src/api/lib/serialize'
import { jobs, projects, users } from '../../src/db/pg/schema'
import { createPgliteTestDb, type PgliteTestDb } from './helpers/db'

const dialect: string = DIALECT

describe.skipIf(dialect !== 'postgresql')('postgres project summaries', () => {
  const state: { current: PgliteTestDb | null } = { current: null }
  beforeAll(async () => {
    state.current = await createPgliteTestDb()
  })
  afterAll(async () => {
    await state.current?.close()
  })

  test('counts jobs and decodes aggregate timestamps including empty projects', async () => {
    const instance = state.current
    if (instance === null) {
      throw new Error('test db not started')
    }
    const { db, raw } = instance
    const createdAt = dayjs('2026-01-01T00:00:00.000Z').toDate()
    const [owner] = await raw
      .insert(users)
      .values({
        id: 'summary-owner',
        handle: 'summary-owner',
        displayName: 'Summary Owner',
        cfAccessEmail: 'summary-owner@example.com',
        role: 'user',
        createdAt,
      })
      .returning()
    if (owner === undefined) {
      throw new Error('owner not created')
    }
    const rows = await raw
      .insert(projects)
      .values(
        ['active', 'finished', 'empty'].map((id) => ({
          id,
          name: id,
          ownerId: owner.id,
          visibility: 'public' as const,
          createdAt,
        })),
      )
      .returning()
    await raw.insert(jobs).values([
      {
        id: 'active-job',
        projectId: 'active',
        createdBy: owner.id,
        config: {},
        startedAt: dayjs('2026-01-02T00:00:00.000Z').toDate(),
        lastActivityAt: dayjs('2026-01-04T00:00:00.000Z').toDate(),
      },
      {
        id: 'finished-job',
        projectId: 'finished',
        createdBy: owner.id,
        config: {},
        status: 'finished',
        startedAt: dayjs('2026-01-02T00:00:00.000Z').toDate(),
        lastActivityAt: dayjs('2026-01-03T00:00:00.000Z').toDate(),
        finishedAt: dayjs('2026-01-05T00:00:00.000Z').toDate(),
      },
    ])
    const summaries = await loadProjectSummaries(db, rows)
    const response = new Map(
      rows.map((row) => [row.id, toProject(row, owner, summaries.get(row.id))]),
    )
    expect(response.get('active')).toMatchObject({
      job_count: 1,
      updated_at: '2026-01-04T00:00:00.000Z',
    })
    expect(response.get('finished')).toMatchObject({
      job_count: 1,
      updated_at: '2026-01-05T00:00:00.000Z',
    })
    expect(response.get('empty')).toMatchObject({
      job_count: 0,
      updated_at: createdAt.toISOString(),
    })
    expect(await loadProjectSummaries(db, [])).toEqual(new Map())
  })
})
