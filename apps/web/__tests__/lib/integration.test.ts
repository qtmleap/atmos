// Integration tests against workerd (miniflare): D1 with the real migrations,
// the JobLive Durable Object, the ASSETS/OGP path and the Access JWKS fetch.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import { and, asc, desc, eq } from 'drizzle-orm'
import { findUserByAccessToken, requireBearerUser } from '../../src/api/lib/auth'
import { ApiError } from '../../src/api/lib/errors'
import { newId } from '../../src/api/lib/ids'
import { notifyLive } from '../../src/api/lib/live'
import {
  decodeKeysetCursor,
  decodeSerialCursor,
  encodeKeysetCursor,
  encodeSerialCursor,
  keysetCondition,
  serialCondition,
  toPage,
} from '../../src/api/lib/pagination'
import { createDb, logs, projects } from '../../src/db/schema'
import type { LiveMessage, Metric } from '../../src/shared/types'
import { insertAccessToken, insertJob, insertProject, insertUser } from '../helpers/fixtures'
import { jsonOf } from '../helpers/http'
import { createTestEnv, type TestEnv } from '../helpers/miniflare'

const TIMEOUT = 60_000

const t: { current: TestEnv | null } = { current: null }
const testEnv = (): TestEnv => {
  if (t.current === null) {
    throw new Error('test env not started')
  }
  return t.current
}

beforeAll(async () => {
  t.current = await createTestEnv()
}, TIMEOUT)

afterAll(async () => {
  if (t.current !== null) {
    await t.current.dispose()
  }
})

describe('schema', () => {
  test('migrations create every table with CHECK constraints', async () => {
    const { env } = testEnv()
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name <> 'sqlite_sequence' ORDER BY name",
    ).all<{ name: string }>()
    expect(result.results.map((row) => row.name)).toEqual([
      'access_tokens',
      'jobs',
      'logs',
      'media_assets',
      'metrics',
      'projects',
      'users',
    ])
    const owner = await insertUser(env.DB)
    const insertBad = env.DB.prepare(
      "INSERT INTO projects (id, name, visibility, owner_id, created_at) VALUES (?, 'x', 'secret', ?, 0)",
    )
      .bind(newId(), owner.id)
      .run()
    expect(insertBad).rejects.toThrow(/CHECK constraint failed/)
  })

  test('jobs.config round-trips as JSON and timestamps as Date', async () => {
    const { env } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project, { config: { lr: 0.001, layers: [1, 2] } })
    const stored = await createDb(env.DB).query.jobs.findFirst({
      where: (jobsTable, { eq: equals }) => equals(jobsTable.id, job.id),
    })
    expect(stored === undefined ? null : stored.config).toEqual({ lr: 0.001, layers: [1, 2] })
    expect(stored === undefined ? null : stored.startedAt).toBeInstanceOf(Date)
  })
})

describe('bearer tokens against D1', () => {
  test('finds the owner of an active token only', async () => {
    const { env } = testEnv()
    const db = createDb(env.DB)
    const alice = await insertUser(env.DB)
    const active = await insertAccessToken(env.DB, alice)
    const revoked = await insertAccessToken(env.DB, alice, { revoked: true })

    const found = await findUserByAccessToken(db, active)
    expect(found === null ? null : found.id).toBe(alice.id)
    expect(await findUserByAccessToken(db, revoked)).toBeNull()
    expect(await findUserByAccessToken(db, 'unknown-token')).toBeNull()
  })

  test('requireBearerUser throws 401 without a valid token', async () => {
    const { env } = testEnv()
    const alice = await insertUser(env.DB)
    const token = await insertAccessToken(env.DB, alice)
    const ok = await requireBearerUser(
      env,
      new Request('http://x/', { headers: { Authorization: `Bearer ${token}` } }),
    )
    expect(ok.id).toBe(alice.id)

    const failure = await requireBearerUser(env, new Request('http://x/')).catch(
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure instanceof ApiError ? failure.status : null).toBe(401)
  })
})

describe('Access JWT through the Worker', () => {
  test('resolves the registered viewer; anonymous and unknown emails are null', async () => {
    const { env, access, dispatch } = testEnv()
    const bob = await insertUser(env.DB, { handle: 'bob', cfAccessEmail: 'bob@example.com' })

    const signedIn = await dispatch('/__test/viewer', {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: bob.cfAccessEmail }) },
    })
    expect(await jsonOf(signedIn)).toEqual({ viewer: 'bob' })

    const anonymous = await dispatch('/__test/viewer')
    expect(await jsonOf(anonymous)).toEqual({ viewer: null })

    const stranger = await dispatch('/__test/viewer', {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: 'nobody@example.com' }) },
    })
    expect(await jsonOf(stranger)).toEqual({ viewer: null })

    const forged = await dispatch('/__test/viewer', {
      headers: {
        'Cf-Access-Jwt-Assertion': await access.sign({ email: bob.cfAccessEmail, aud: 'other' }),
      },
    })
    expect(await jsonOf(forged)).toEqual({ viewer: null })
  })

  test('the JWKS is fetched once and then cached', async () => {
    const { access, dispatch, jwksFetches } = testEnv()
    const headers = { 'Cf-Access-Jwt-Assertion': await access.sign({ email: 'x@example.com' }) }
    await dispatch('/__test/viewer', { headers })
    const before = jwksFetches()
    await dispatch('/__test/viewer', { headers })
    await dispatch('/__test/viewer', { headers })
    expect(before).toBe(1)
    expect(jwksFetches()).toBe(1)
  })

  test('requireAccessUser answers 401 in the SPEC error shape', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/__test/me')
    expect(res.status).toBe(401)
    const body = await jsonOf(res)
    expect(body).toMatchObject({ error: { code: 'unauthenticated' } })
  })
})

describe('pagination against D1', () => {
  test('keyset cursor walks UUID rows newest first without gaps or repeats', async () => {
    const { env } = testEnv()
    const db = createDb(env.DB)
    const owner = await insertUser(env.DB)
    const base = dayjs('2026-01-01T00:00:00Z')
    // Five projects, two sharing a timestamp to exercise the id tie-breaker.
    const offsets = [0, 1, 1, 2, 3]
    const inserted = await Promise.all(
      offsets.map((offset, index) =>
        insertProject(env.DB, owner, {
          name: `paged ${index}`,
          createdAt: base.add(offset, 'second').toDate(),
        }),
      ),
    )

    const fetchPage = async (cursor: string | null) => {
      const rows = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.ownerId, owner.id),
            cursor === null
              ? undefined
              : keysetCondition(
                  projects.createdAt,
                  projects.id,
                  decodeKeysetCursor(cursor),
                  'desc',
                ),
          ),
        )
        .orderBy(desc(projects.createdAt), desc(projects.id))
        .limit(2 + 1)
      return toPage(
        rows,
        2,
        (row) => row.id,
        (row) => encodeKeysetCursor(row.createdAt, row.id),
      )
    }

    const collect = async (cursor: string | null, acc: string[]): Promise<string[]> => {
      const page = await fetchPage(cursor)
      const all = [...acc, ...page.items]
      return page.next_cursor === null ? all : collect(page.next_cursor, all)
    }

    const walked = await collect(null, [])
    const expected = [...inserted]
      .sort((a, b) =>
        a.createdAt.getTime() === b.createdAt.getTime()
          ? b.id.localeCompare(a.id)
          : b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .map((row) => row.id)
    expect(walked).toEqual(expected)
  })

  test('serial cursor walks integer rows in id order', async () => {
    const { env } = testEnv()
    const db = createDb(env.DB)
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner)
    const job = await insertJob(env.DB, project)
    await db.insert(logs).values(
      Array.from({ length: 5 }, (_, index) => ({
        jobId: job.id,
        stream: 'stdout' as const,
        message: `line ${index}`,
        loggedAt: dayjs().toDate(),
      })),
    )

    const fetchPage = async (cursor: string | null) => {
      const rows = await db
        .select()
        .from(logs)
        .where(
          and(
            eq(logs.jobId, job.id),
            cursor === null
              ? undefined
              : serialCondition(logs.id, decodeSerialCursor(cursor), 'asc'),
          ),
        )
        .orderBy(asc(logs.id))
        .limit(2 + 1)
      return toPage(
        rows,
        2,
        (row) => row.message,
        (row) => encodeSerialCursor(row.id),
      )
    }

    const first = await fetchPage(null)
    expect(first.items).toEqual(['line 0', 'line 1'])
    const second = await fetchPage(first.next_cursor)
    expect(second.items).toEqual(['line 2', 'line 3'])
    const third = await fetchPage(second.next_cursor)
    expect(third).toEqual({ items: ['line 4'], next_cursor: null })
  })
})

describe('JobLive Durable Object', () => {
  const openSocket = async (jobId: string) => {
    const { dispatch } = testEnv()
    const res = await dispatch(`/__test/live/${jobId}`, { headers: { Upgrade: 'websocket' } })
    expect(res.status).toBe(101)
    const ws = res.webSocket
    if (ws === null || ws === undefined) {
      throw new Error('no websocket in the 101 response')
    }
    const received: string[] = []
    const closed: { code: number | null } = { code: null }
    ws.addEventListener('message', (event) => {
      received.push(typeof event.data === 'string' ? event.data : '<binary>')
    })
    ws.addEventListener('close', (event) => {
      closed.code = event.code
    })
    ws.accept()
    return { ws, received, closed }
  }

  const waitFor = async (check: () => boolean, remaining = 100): Promise<void> => {
    if (check()) {
      return
    }
    if (remaining === 0) {
      throw new Error('condition not met in time')
    }
    await Bun.sleep(20)
    return waitFor(check, remaining - 1)
  }

  const metric = (jobId: string): Metric => ({
    id: '1',
    job_id: jobId,
    step: 1,
    key: 'loss',
    value: 0.5,
    logged_at: '2026-09-24T00:00:00.000Z',
  })

  test(
    'broadcasts to every socket of the same job only',
    async () => {
      const { env } = testEnv()
      const jobId = newId()
      const a = await openSocket(jobId)
      const b = await openSocket(jobId)
      const other = await openSocket(newId())

      const message: LiveMessage = { type: 'metric', data: metric(jobId) }
      const result = await notifyLive(env, jobId, message)
      expect(result).toEqual({ delivered: 2 })

      await waitFor(() => a.received.length === 1 && b.received.length === 1)
      expect(JSON.parse(a.received[0] === undefined ? 'null' : a.received[0])).toEqual(message)
      expect(b.received).toEqual(a.received)
      expect(other.received).toEqual([])
      for (const socket of [a, b, other]) {
        socket.ws.close(1000)
      }
    },
    TIMEOUT,
  )

  test(
    'a finished status is delivered and then closes with 1000',
    async () => {
      const { env } = testEnv()
      const jobId = newId()
      const socket = await openSocket(jobId)

      const running: LiveMessage = {
        type: 'status',
        data: { status: 'running', finished_at: null },
      }
      await notifyLive(env, jobId, running)
      await waitFor(() => socket.received.length === 1)
      expect(socket.closed.code).toBeNull()

      const finished: LiveMessage = {
        type: 'status',
        data: { status: 'finished', finished_at: '2026-09-24T01:00:00.000Z' },
      }
      await notifyLive(env, jobId, finished)
      await waitFor(() => socket.closed.code !== null)
      expect(socket.received.map((frame) => JSON.parse(frame))).toEqual([running, finished])
      expect(socket.closed.code).toBe(1000)

      const stub = env.JOB_LIVE.get(env.JOB_LIVE.idFromName(jobId))
      const pollCount = async (remaining: number): Promise<number> => {
        const count = await stub.connectionCount()
        if (count === 0 || remaining === 0) {
          return count
        }
        await Bun.sleep(20)
        return pollCount(remaining - 1)
      }
      expect(await pollCount(100)).toBe(0)
    },
    TIMEOUT,
  )

  test('rejects non-upgrade requests', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch(`/__test/live/${newId()}`)
    expect(res.status).toBe(426)
  })

  test('notifyLive with no listeners delivers to nobody', async () => {
    const { env } = testEnv()
    expect(await notifyLive(env, newId(), { type: 'metric', data: metric('x') })).toEqual({
      delivered: 0,
    })
  })
})

describe('app routing and OGP', () => {
  test('unknown /api paths are JSON 404s, not the SPA', async () => {
    const { dispatch, assetRequests } = testEnv()
    const before = assetRequests.length
    const res = await dispatch('/api/nope')
    expect(res.status).toBe(404)
    expect(await jsonOf(res)).toEqual({
      error: { code: 'not_found', message: 'no such API endpoint' },
    })
    expect(assetRequests.length).toBe(before)
  })

  test('other paths are served from ASSETS unchanged', async () => {
    const { dispatch } = testEnv()
    const res = await dispatch('/settings/profile')
    const html = await res.text()
    expect(html).toContain('<title>atmos</title>')
    expect(html).toContain('content="default description"')
  })

  test('a public project page gets its name as og:title', async () => {
    const { env, dispatch } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { name: 'Tokyo "RL" <runs>' })
    const res = await dispatch(`/projects/${project.id}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('ETag')).toBeNull()
    const html = await res.text()
    expect(html).toContain('<title>Tokyo "RL" &lt;runs&gt; | atmos</title>')
    expect(html).toContain('<meta property="og:title" content="Tokyo &quot;RL&quot; &lt;runs&gt;">')
    // miniflare rewrites the host to its own listener, so only the path is fixed.
    expect(html).toMatch(
      new RegExp(`<meta property="og:url" content="http://[^"/]+/projects/${project.id}">`),
    )
    expect(html).not.toContain('default description')
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
  })

  test('a job page combines the job and project names', async () => {
    const { env, dispatch } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { name: 'vision' })
    const job = await insertJob(env.DB, project, { name: 'exp1' })
    const html = await (await dispatch(`/projects/${project.id}/jobs/${job.id}`)).text()
    expect(html).toContain('<meta property="og:title" content="exp1 · vision">')

    const mismatched = await (await dispatch(`/projects/${newId()}/jobs/${job.id}`)).text()
    expect(mismatched).toContain('<title>atmos</title>')
  })

  test('a private project keeps the default tags', async () => {
    const { env, dispatch } = testEnv()
    const owner = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { name: 'secret', visibility: 'private' })
    const html = await (await dispatch(`/projects/${project.id}`)).text()
    expect(html).not.toContain('secret')
    expect(html).toContain('<title>atmos</title>')
  })

  test('a user page shows display_name and the avatar as og:image', async () => {
    const { env, dispatch } = testEnv()
    await insertUser(env.DB, { handle: 'carol', displayName: 'キャロル', avatarKey: 'avatars/c' })
    const html = await (await dispatch('/users/carol')).text()
    expect(html).toContain('<meta property="og:title" content="キャロル">')
    expect(html).toMatch(
      /<meta property="og:image" content="http:\/\/[^"/]+\/api\/users\/carol\/avatar">/,
    )

    await insertUser(env.DB, { handle: 'dave', displayName: 'Dave' })
    const noAvatar = await (await dispatch('/users/dave')).text()
    expect(noAvatar).not.toContain('og:image')
  })

  test('an unknown user keeps the default tags', async () => {
    const { dispatch } = testEnv()
    const html = await (await dispatch('/users/nobody-here')).text()
    expect(html).toContain('<title>atmos</title>')
  })
})
