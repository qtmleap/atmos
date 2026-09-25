// GET /api/projects (designs/pages/projects.html), GET /api/projects/:project_id
// and POST /api/projects.
//
// The mock's table also shows a job count and a last-updated time, which the
// wire type `Project` (src/shared/types.ts) does not carry. They are sent as
// the extra fields `job_count` and `updated_at` so the numbers exist once the
// type grows them; until then the page simply ignores them.
import type {
  CreateProjectRequest,
  Project,
  UpdateProjectRequest,
  Visibility,
} from '../../src/shared/types'
import { VISIBILITIES } from '../../src/shared/types'
import { ME } from './me'
import { apiError, type FixtureHandler, json, noContent, notFound, paginate } from './respond'
import { ownerOf } from './users'

export interface FixtureProject extends Project {
  job_count: number
  updated_at: string
}

export const VITS_PROJECT_ID = 'prj_vits'

const project = (
  id: string,
  name: string,
  visibility: Project['visibility'],
  ownerHandle: string,
  jobCount: number,
  updatedAt: string,
  createdAt: string,
): FixtureProject => ({
  id,
  name,
  visibility,
  owner: ownerOf(ownerHandle),
  created_at: createdAt,
  job_count: jobCount,
  updated_at: updatedAt,
})

/** The ten rows of projects.html, newest update first; "10件表示 · 先頭 · 続きあり". */
const LISTED: readonly FixtureProject[] = [
  project(
    VITS_PROJECT_ID,
    '日本語音声合成 / VITS',
    'private',
    'misaki_t',
    248,
    '2026-09-24T14:32:00Z',
    '2026-08-20T09:00:00Z',
  ),
  project(
    'prj_sdxl_lora',
    '画像生成 / SDXL LoRA',
    'private',
    'aoi_ml',
    186,
    '2026-09-24T14:18:00Z',
    '2026-08-22T09:00:00Z',
  ),
  project(
    'prj_styletts2',
    '多話者音声合成 / StyleTTS2',
    'private',
    'yuto_s',
    124,
    '2026-09-24T13:56:00Z',
    '2026-08-25T09:00:00Z',
  ),
  project(
    'prj_tts_ja_baseline',
    '日本語音声合成 / ベースライン',
    'public',
    'misaki_t',
    96,
    '2026-09-24T12:40:00Z',
    '2026-08-12T09:00:00Z',
  ),
  project(
    'prj_flux_distill',
    '画像生成 / FLUX 蒸留',
    'private',
    'ren_t',
    72,
    '2026-09-24T11:25:00Z',
    '2026-09-01T09:00:00Z',
  ),
  project(
    'prj_bigvgan',
    'ボコーダ / BigVGAN',
    'public',
    'yuto_s',
    83,
    '2026-09-24T10:08:00Z',
    '2026-08-28T09:00:00Z',
  ),
  project(
    'prj_controlnet_depth',
    '画像生成 / ControlNet 深度条件',
    'public',
    'aoi_ml',
    64,
    '2026-09-23T22:46:00Z',
    '2026-09-03T09:00:00Z',
  ),
  project(
    'prj_tts_emotion',
    '音声合成 / 感情表現の制御',
    'private',
    'rin_ito',
    57,
    '2026-09-23T20:12:00Z',
    '2026-09-05T09:00:00Z',
  ),
  project(
    'prj_anime_lora',
    '画像生成 / アニメ調 LoRA',
    'private',
    'ren_t',
    112,
    '2026-09-23T18:35:00Z',
    '2026-08-30T09:00:00Z',
  ),
  project(
    'prj_tts_few_shot',
    '音声合成 / 少量データ適応',
    'public',
    'rin_ito',
    38,
    '2026-09-23T16:04:00Z',
    '2026-09-08T09:00:00Z',
  ),
]

/** Past the first page; not drawn in any mock. */
const MORE: readonly FixtureProject[] = [
  project(
    'prj_hifigan_ft',
    'ボコーダ / HiFi-GAN 微調整',
    'public',
    'haruto_w',
    29,
    '2026-09-23T11:48:00Z',
    '2026-09-10T09:00:00Z',
  ),
  project(
    'prj_sd15_inpaint',
    '画像生成 / SD1.5 インペイント',
    'private',
    'sakura_y',
    41,
    '2026-09-22T19:20:00Z',
    '2026-09-02T09:00:00Z',
  ),
  project(
    'prj_whisper_ja',
    '音声認識 / Whisper 日本語',
    'public',
    'minato_n',
    18,
    '2026-09-22T08:05:00Z',
    '2026-09-12T09:00:00Z',
  ),
  project(
    'prj_upscaler',
    '画像生成 / 超解像',
    'private',
    'yui_k',
    22,
    '2026-09-21T15:37:00Z',
    '2026-09-06T09:00:00Z',
  ),
]

const PROJECTS: readonly FixtureProject[] = [...LISTED, ...MORE]

/**
 * PATCH /api/projects/:project_id overlay: name/visibility written since the
 * dev server started, so a rename or a visibility change survives a re-render
 * of the same page.
 */
const EDITED: Map<string, Partial<Pick<FixtureProject, 'name' | 'visibility'>>> = new Map()

/** DELETE /api/projects/:project_id overlay: ids removed since the dev server started. */
const DELETED: Set<string> = new Set()

const withOverlay = (project: FixtureProject): FixtureProject => {
  const edit = EDITED.get(project.id)
  return edit === undefined ? project : { ...project, ...edit }
}

export const findProject = (id: string): FixtureProject | undefined => {
  if (DELETED.has(id)) {
    return undefined
  }
  const found = PROJECTS.find((row) => row.id === id)
  return found === undefined ? undefined : withOverlay(found)
}

export const listProjects: FixtureHandler = ({ url }) =>
  json(
    paginate(PROJECTS.filter((row) => !DELETED.has(row.id)).map(withOverlay), url, LISTED.length),
  )

/** GET /api/projects/:project_id — the heading of project-jobs.html and friends. */
export const getProject: FixtureHandler = ({ params }) => {
  const project = params.project_id === undefined ? undefined : findProject(params.project_id)
  return project === undefined ? notFound('project') : json(project)
}

const isCreateProjectRequest = (value: unknown): value is CreateProjectRequest =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  typeof value.name === 'string' &&
  value.name !== ''

/** Answers like a create (201) but keeps nothing: the fixtures are read-only. */
export const createProject: FixtureHandler = async ({ json: body }) => {
  const request = await body()
  if (!isCreateProjectRequest(request)) {
    return json({ error: { code: 'validation_error', message: 'name is required' } }, 400)
  }
  const existing = PROJECTS.find((row) => row.name === request.name)
  if (existing !== undefined) {
    return json(existing)
  }
  const created: Project = {
    id: 'prj_fixture_new',
    name: request.name,
    visibility: request.visibility === 'public' ? 'public' : 'private',
    owner: ownerOf(ME.handle),
    created_at: '2026-09-24T14:32:00Z',
  }
  return json(created, 201)
}

const isVisibility = (value: unknown): value is Visibility =>
  VISIBILITIES.some((visibility) => visibility === value)

const isUpdateProjectRequest = (value: unknown): value is UpdateProjectRequest => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const name = 'name' in value ? value.name : undefined
  const visibility = 'visibility' in value ? value.visibility : undefined
  if (name !== undefined && (typeof name !== 'string' || name === '')) {
    return false
  }
  if (visibility !== undefined && !isVisibility(visibility)) {
    return false
  }
  return name !== undefined || visibility !== undefined
}

/**
 * Persists into the EDITED overlay: the web UI stays on the project after
 * saving, and the renamed project has to still read that way. 409 `conflict`
 * on a name collision with another project of the same owner, mirroring the
 * real API (src/api/routes/projects.ts).
 */
export const updateProject: FixtureHandler = async ({ params, json: body }) => {
  const project = params.project_id === undefined ? undefined : findProject(params.project_id)
  if (project === undefined) {
    return notFound('project')
  }
  const request = await body()
  if (!isUpdateProjectRequest(request)) {
    return apiError(400, 'validation_error', 'at least one of name or visibility is required')
  }
  if (request.name !== undefined && request.name !== project.name) {
    const collision = PROJECTS.filter((row) => !DELETED.has(row.id) && row.id !== project.id)
      .map(withOverlay)
      .find((row) => row.owner.handle === project.owner.handle && row.name === request.name)
    if (collision !== undefined) {
      return apiError(409, 'conflict', 'a project with this name already exists')
    }
  }
  EDITED.set(project.id, {
    ...EDITED.get(project.id),
    ...(request.name === undefined ? {} : { name: request.name }),
    ...(request.visibility === undefined ? {} : { visibility: request.visibility }),
  })
  const updated = findProject(project.id)
  return updated === undefined ? notFound('project') : json(updated)
}

/**
 * Marks the project deleted in the DELETED overlay: the web UI navigates away
 * and the project must stop being found afterwards, list included.
 */
export const deleteProject: FixtureHandler = ({ params }) => {
  const project = params.project_id === undefined ? undefined : findProject(params.project_id)
  if (project === undefined) {
    return notFound('project')
  }
  DELETED.add(project.id)
  return noContent()
}
