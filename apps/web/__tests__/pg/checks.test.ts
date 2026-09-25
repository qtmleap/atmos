// CHECK constraints from the generated migration (jobs_status_check,
// media_assets_kind_check, logs_stream_check, users_role_check). Inserted
// through raw SQL, not the query builder: the enum values these constraints
// reject are not valid values of the corresponding TS union, so the query
// builder can't express them without an `as` cast.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import { sql } from 'drizzle-orm'
import { DIALECT } from '#schema'
import { jobs, projects, users } from '../../src/db/pg/schema'
import { createPgliteTestDb, type PgliteTestDb } from './helpers/db'

const dialect: string = DIALECT

// `.rejects` needs a genuine Promise; `raw.execute(...)` returns a thenable
// `PgRaw`, not a Promise instance, so wrap it.
const rejects = (query: PromiseLike<unknown>): Promise<unknown> =>
  (async () => {
    await query
  })()

describe.skipIf(dialect !== 'postgresql')('CHECK constraints', () => {
  const t: { current: PgliteTestDb | null } = { current: null }
  const testDb = (): PgliteTestDb => {
    if (t.current === null) {
      throw new Error('test db not started')
    }
    return t.current
  }

  beforeAll(async () => {
    t.current = await createPgliteTestDb()
    const { db } = testDb()
    const createdAt = dayjs('2026-03-01T00:00:00.000Z').toDate()
    await db.insert(users).values({
      id: 'checks-owner',
      handle: 'checks-owner',
      displayName: 'Checks Owner',
      avatarKey: null,
      cfAccessEmail: 'checks-owner@example.com',
      role: 'user',
      createdAt,
    })
    await db.insert(projects).values({
      id: 'checks-project',
      name: 'checks project',
      visibility: 'public',
      ownerId: 'checks-owner',
      createdAt,
    })
    await db.insert(jobs).values({
      id: 'checks-job',
      projectId: 'checks-project',
      name: null,
      status: 'running',
      config: {},
      createdBy: 'checks-owner',
      startedAt: createdAt,
      finishedAt: null,
    })
  })

  afterAll(async () => {
    if (t.current !== null) {
      await t.current.close()
    }
  })

  test('users_role_check rejects a role outside admin/user', async () => {
    const { raw } = testDb()
    await expect(
      rejects(
        raw.execute(sql`
        INSERT INTO users (id, handle, display_name, cf_access_email, role, created_at)
        VALUES ('bad-role', 'bad-role', 'Bad Role', 'bad-role@example.com', 'superadmin', now())
      `),
      ),
    ).rejects.toThrow()
  })

  test('jobs_status_check rejects a status outside running/finished/failed', async () => {
    const { raw } = testDb()
    await expect(
      rejects(
        raw.execute(sql`
        INSERT INTO jobs (id, project_id, status, config, created_by, started_at)
        VALUES ('bad-status', 'checks-project', 'queued', '{}'::jsonb, 'checks-owner', now())
      `),
      ),
    ).rejects.toThrow()
  })

  test('logs_stream_check rejects a stream outside stdout/stderr', async () => {
    const { raw } = testDb()
    await expect(
      rejects(
        raw.execute(sql`
        INSERT INTO logs (job_id, stream, message, logged_at)
        VALUES ('checks-job', 'stdin', 'oops', now())
      `),
      ),
    ).rejects.toThrow()
  })

  test('media_assets_kind_check rejects a kind outside image/audio', async () => {
    const { raw } = testDb()
    await expect(
      rejects(
        raw.execute(sql`
        INSERT INTO media_assets (id, job_id, step, kind, label, r2_key, content_type, size, logged_at)
        VALUES ('bad-media', 'checks-job', 1, 'video', 'sample', 'k', 'video/mp4', 1, now())
      `),
      ),
    ).rejects.toThrow()
  })
})
