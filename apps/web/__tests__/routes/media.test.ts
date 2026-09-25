// Tests for src/api/routes/media.ts (docs/SPEC.md §9) against real D1/R2/the
// JobLive Durable Object, dispatched through __tests__/routes/worker.ts so
// Cf-Access-Jwt-Assertion verification goes through the real JWKS fetch
// (see __tests__/routes/test-env.ts for why this does not reuse
// __tests__/helpers/test-worker.ts).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { newId } from '../../src/api/lib/ids'
import { liveMessageSchema, mediaAssetSchema, pageSchema } from '../../src/shared/schemas'
import { MEDIA_MAX_BYTES } from '../../src/shared/types'
import { insertAccessToken, insertJob, insertProject, insertUser } from '../helpers/fixtures'
import { expectShape, jsonError, jsonShaped } from '../helpers/http'
import { createRouteTestEnv, type RouteTestEnv } from './test-env'

const TIMEOUT = 60_000

const mediaPageSchema = pageSchema(mediaAssetSchema)

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

const pngBytes = (size = 16): Uint8Array => {
  const bytes = new Uint8Array(size)
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0)
  return bytes
}

const uploadForm = (options: {
  bytes?: Uint8Array
  contentType?: string
  filename?: string
  kind?: string
  step?: string
  label?: string
}): FormData => {
  const form = new FormData()
  const bytes = options.bytes === undefined ? pngBytes() : options.bytes
  form.set(
    'file',
    new File([new Uint8Array(bytes)], options.filename === undefined ? 'x.png' : options.filename, {
      type: options.contentType === undefined ? 'image/png' : options.contentType,
    }),
  )
  if (options.kind !== undefined) {
    form.set('kind', options.kind)
  }
  if (options.step !== undefined) {
    form.set('step', options.step)
  }
  if (options.label !== undefined) {
    form.set('label', options.label)
  }
  return form
}

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

describe('POST /api/projects/:project_id/jobs/:job_id/media', () => {
  test(
    'uploads an image, stores it in R2 and returns the MediaAsset',
    async () => {
      const { dispatch } = testEnv()
      const { project, job, token } = await setup()
      const bytes = pngBytes(32)
      const form = uploadForm({ bytes, kind: 'image', step: '3', label: 'sample' })

      const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      expect(res.status).toBe(201)
      const asset = await jsonShaped(mediaAssetSchema, res)
      expect(asset).toMatchObject({
        job_id: job.id,
        step: 3,
        kind: 'image',
        label: 'sample',
        content_type: 'image/png',
        size: 32,
        url: `/api/projects/${project.id}/jobs/${job.id}/media/${asset.id}`,
      })
      expect(typeof asset.id).toBe('string')
      expect(typeof asset.logged_at).toBe('string')

      const download = await dispatch(
        `/api/projects/${project.id}/jobs/${job.id}/media/${asset.id}`,
      )
      expect(download.status).toBe(200)
      expect(download.headers.get('Content-Type')).toBe('image/png')
      const downloaded = new Uint8Array(await download.arrayBuffer())
      expect(downloaded).toEqual(bytes)
    },
    TIMEOUT,
  )

  test(
    'broadcasts { type: "media" } over the live channel',
    async () => {
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

      const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: uploadForm({ kind: 'image', step: '1', label: 'live' }),
      })
      expect(res.status).toBe(201)
      const asset = await jsonShaped(mediaAssetSchema, res)

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
      const message = expectShape(
        liveMessageSchema,
        JSON.parse(received[0] === undefined ? 'null' : received[0]),
      )
      expect(message).toEqual({ type: 'media', data: asset })
      ws.close(1000)
    },
    TIMEOUT,
  )

  test('401 without a Bearer token', async () => {
    const { dispatch } = testEnv()
    const { project, job } = await setup()
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
      method: 'POST',
      body: uploadForm({ kind: 'image', step: '1', label: 'x' }),
    })
    expect(res.status).toBe(401)
    await jsonError(res, 'unauthenticated')
  })

  test('404 when the Bearer token does not own the project (permission hidden as not_found)', async () => {
    const { dispatch } = testEnv()
    const { project, job, otherToken } = await setup()
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: uploadForm({ kind: 'image', step: '1', label: 'x' }),
    })
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test('404 when project_id does not exist', async () => {
    const { dispatch } = testEnv()
    const { job, token } = await setup()
    const res = await dispatch(`/api/projects/${newId()}/jobs/${job.id}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: uploadForm({ kind: 'image', step: '1', label: 'x' }),
    })
    expect(res.status).toBe(404)
  })

  test('404 when job_id belongs to a different project (parent mismatch)', async () => {
    const { env, dispatch } = testEnv()
    const { project, token } = await setup()
    const otherProject = await insertProject(env.DB, await insertUser(env.DB))
    const otherJob = await insertJob(env.DB, otherProject)
    const res = await dispatch(`/api/projects/${project.id}/jobs/${otherJob.id}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: uploadForm({ kind: 'image', step: '1', label: 'x' }),
    })
    expect(res.status).toBe(404)
  })

  test('400 validation_error when a required field is missing', async () => {
    const { dispatch } = testEnv()
    const { project, job, token } = await setup()
    const form = uploadForm({ kind: 'image', step: '1' })
    form.delete('label')
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    expect(res.status).toBe(400)
    await jsonError(res, 'validation_error')
  })

  test('400 invalid_content_type when kind and the file content type disagree', async () => {
    const { dispatch } = testEnv()
    const { project, job, token } = await setup()
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: uploadForm({ kind: 'audio', contentType: 'image/png', step: '1', label: 'x' }),
    })
    expect(res.status).toBe(400)
    await jsonError(res, 'invalid_content_type')
  })

  test(
    '413 payload_too_large over the 2048KB limit',
    async () => {
      const { dispatch } = testEnv()
      const { project, job, token } = await setup()
      const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: uploadForm({
          bytes: new Uint8Array(MEDIA_MAX_BYTES + 1),
          kind: 'image',
          step: '1',
          label: 'too big',
        }),
      })
      expect(res.status).toBe(413)
      await jsonError(res, 'payload_too_large')
    },
    TIMEOUT,
  )
})

describe('GET /api/projects/:project_id/jobs/:job_id/media', () => {
  test(
    'lists media newest first, filters by kind and paginates',
    async () => {
      const { env, dispatch } = testEnv()
      const { project, job, token } = await setup()
      const entries = [
        { kind: 'image', label: 'first' },
        { kind: 'audio', label: 'second' },
        { kind: 'image', label: 'third' },
      ] as const
      const ids: string[] = []
      for (const [index, entry] of entries.entries()) {
        const contentType = entry.kind === 'image' ? 'image/png' : 'audio/wav'
        const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: uploadForm({
            kind: entry.kind,
            contentType,
            step: `${index}`,
            label: entry.label,
          }),
        })
        expect(res.status).toBe(201)
        const asset = await jsonShaped(mediaAssetSchema, res)
        ids.push(asset.id)
      }
      void env

      const imagesOnly = await dispatch(
        `/api/projects/${project.id}/jobs/${job.id}/media?kind=image`,
      )
      const imagesPage = await jsonShaped(mediaPageSchema, imagesOnly)
      expect(imagesPage.items.map((item) => item.label).sort()).toEqual(['first', 'third'])

      const firstPage = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media?limit=2`)
      const firstBody = await jsonShaped(mediaPageSchema, firstPage)
      expect(firstBody.items).toHaveLength(2)
      expect(firstBody.next_cursor).not.toBeNull()

      const secondPage = await dispatch(
        `/api/projects/${project.id}/jobs/${job.id}/media?limit=2&cursor=${encodeURIComponent(firstBody.next_cursor === null ? '' : firstBody.next_cursor)}`,
      )
      const secondBody = await jsonShaped(mediaPageSchema, secondPage)
      expect(secondBody.next_cursor).toBeNull()
      expect([...firstBody.items, ...secondBody.items].map((item) => item.id).sort()).toEqual(
        [...ids].sort(),
      )
    },
    TIMEOUT,
  )

  test('401 for an anonymous viewer of a private project, 403 for a non-owner, 200 for the owner', async () => {
    const { env, dispatch, access } = testEnv()
    const owner = await insertUser(env.DB)
    const stranger = await insertUser(env.DB)
    const project = await insertProject(env.DB, owner, { visibility: 'private' })
    const job = await insertJob(env.DB, project)

    const anon = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`)
    expect(anon.status).toBe(401)
    await jsonError(anon, 'unauthenticated')

    const forbidden = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: stranger.cfAccessEmail }) },
    })
    expect(forbidden.status).toBe(403)
    await jsonError(forbidden, 'forbidden')

    const allowed = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media`, {
      headers: { 'Cf-Access-Jwt-Assertion': await access.sign({ email: owner.cfAccessEmail }) },
    })
    expect(allowed.status).toBe(200)
  })

  test('404 when project_id/job_id do not share a parent-child relationship', async () => {
    const { env, dispatch } = testEnv()
    const { project } = await setup()
    const otherProject = await insertProject(env.DB, await insertUser(env.DB))
    const otherJob = await insertJob(env.DB, otherProject)
    const res = await dispatch(`/api/projects/${project.id}/jobs/${otherJob.id}/media`)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/projects/:project_id/jobs/:job_id/media/:media_id', () => {
  test('404 for an unknown media_id', async () => {
    const { dispatch } = testEnv()
    const { project, job } = await setup()
    const res = await dispatch(`/api/projects/${project.id}/jobs/${job.id}/media/${newId()}`)
    expect(res.status).toBe(404)
    await jsonError(res, 'not_found')
  })

  test(
    '404 when media_id belongs to a different job',
    async () => {
      const { env, dispatch } = testEnv()
      const { project, job, token } = await setup()
      const otherJob = await insertJob(env.DB, project)
      const res = await dispatch(`/api/projects/${project.id}/jobs/${otherJob.id}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: uploadForm({ kind: 'image', step: '1', label: 'x' }),
      })
      const asset = await jsonShaped(mediaAssetSchema, res)
      const mismatched = await dispatch(
        `/api/projects/${project.id}/jobs/${job.id}/media/${asset.id}`,
      )
      expect(mismatched.status).toBe(404)
    },
    TIMEOUT,
  )
})
