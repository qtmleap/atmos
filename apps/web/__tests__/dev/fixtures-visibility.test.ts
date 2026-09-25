import { describe, expect, test } from 'bun:test'
import { getMe } from '../../dev/fixtures/me'
import { getProject, listProjects } from '../../dev/fixtures/projects'
import type { FixtureRequest, FixtureResponse } from '../../dev/fixtures/respond'
import { listUserProjects } from '../../dev/fixtures/users'

const request = (
  path: string,
  scenario: string | null,
  params: Record<string, string> = {},
): FixtureRequest => ({
  method: 'GET',
  url: new URL(path, 'http://localhost/'),
  params,
  scenario,
  pagePath: null,
  json: async () => undefined,
})

const body = (response: FixtureResponse) => JSON.parse(String(response.body))

interface Row {
  id: string
  visibility: string
}

describe('signed-out scenario', () => {
  test('GET /api/me answers 401', async () => {
    expect((await getMe(request('/api/me', 'signed-out'))).status).toBe(401)
  })

  test('the project list holds the six public projects on one page', async () => {
    const page = body(await listProjects(request('/api/projects', 'signed-out')))
    expect(page.items.map((row: Row) => row.id)).toEqual([
      'prj_tts_ja_baseline',
      'prj_bigvgan',
      'prj_controlnet_depth',
      'prj_tts_few_shot',
      'prj_hifigan_ft',
      'prj_whisper_ja',
    ])
    expect(page.next_cursor).toBeNull()
  })

  test('a members-only project answers 401', async () => {
    const response = await getProject(
      request('/api/projects/prj_internal_asr', 'signed-out', { project_id: 'prj_internal_asr' }),
    )
    expect(response.status).toBe(401)
  })

  test("a member's profile lists public projects only", async () => {
    const page = body(
      await listUserProjects(
        request('/api/users/yuto_s/projects', 'signed-out', { handle: 'yuto_s' }),
      ),
    )
    expect(page.items.every((row: Row) => row.visibility === 'public')).toBe(true)
  })
})

describe('signed in', () => {
  test('a members-only project opens', async () => {
    const response = await getProject(
      request('/api/projects/prj_internal_asr', null, { project_id: 'prj_internal_asr' }),
    )
    expect(response.status).toBe(200)
  })

  test("someone else's private project answers 403", async () => {
    const response = await getProject(
      request('/api/projects/prj_private_other', null, { project_id: 'prj_private_other' }),
    )
    expect(response.status).toBe(403)
  })

  test('an unknown project answers 404', async () => {
    const response = await getProject(
      request('/api/projects/prj_missing', null, { project_id: 'prj_missing' }),
    )
    expect(response.status).toBe(404)
  })

  test('unlisted projects stay out of the list', async () => {
    const page = body(await listProjects(request('/api/projects?limit=100', null)))
    const ids = page.items.map((row: Row) => row.id)
    expect(ids).not.toContain('prj_internal_asr')
    expect(ids).not.toContain('prj_private_other')
  })

  test("yuto_s's profile lists his four projects", async () => {
    const page = body(
      await listUserProjects(request('/api/users/yuto_s/projects', null, { handle: 'yuto_s' })),
    )
    expect(page.items.map((row: Row) => row.id)).toEqual([
      'prj_yuto_diarization',
      'prj_yuto_prosody',
      'prj_bigvgan',
      'prj_yuto_codec',
    ])
    expect(page.next_cursor).toBeNull()
  })
})

describe('empty scenario', () => {
  test('the project list is empty', async () => {
    const page = body(await listProjects(request('/api/projects', 'empty')))
    expect(page).toEqual({ items: [], next_cursor: null })
  })
})
