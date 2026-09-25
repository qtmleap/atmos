// Jobs of the project prj_vits: GET /api/projects/:project_id/jobs
// (designs/pages/project-jobs.html shows the first eight rows,
// project-jobs-compare-drawer.html all twelve). Opening one of them, and
// POST .../finish, is job-detail.ts.
//
// The list's "ステップ" column (last step received) is not part of the wire
// type `Job`; it is sent as the extra field `last_step`. The run time column
// follows from started_at / finished_at (running rows: until "now", which the
// mock fixes at 2026-09-24 14:32 UTC).
import dayjs from 'dayjs'
import { JOB_STATUSES, type Job, type JobStatus } from '../../src/shared/types'
import { ME } from './me'
import { VITS_PROJECT_ID } from './projects'
import { type FixtureHandler, json, paginate } from './respond'

export interface FixtureJob extends Job {
  last_step: number
}

const BASE_CONFIG = {
  model: 'vits',
  dataset: 'jsut-v1.1',
  sample_rate: 22050,
  batch_size: 32,
  learning_rate: 0.0003,
  seed: 42,
  max_steps: 240000,
  fp16: true,
}

/** `start` is the mock's "MM-DD HH:mm" (2026, UTC); `runtime` its "HH:mm:ss". */
const job = (
  id: string,
  name: string,
  status: JobStatus,
  start: string,
  runtime: string,
  lastStep: number,
  config: Record<string, unknown>,
): FixtureJob => {
  const startedAt = dayjs(`2026-${start.replace(' ', 'T')}:00Z`)
  const [hours = 0, minutes = 0, seconds = 0] = runtime.split(':').map(Number)
  const finishedAt = startedAt.add(((hours * 60 + minutes) * 60 + seconds) * 1000, 'ms')
  return {
    id,
    project_id: VITS_PROJECT_ID,
    name,
    status,
    config: { ...BASE_CONFIG, ...config },
    created_by: ME.id,
    started_at: startedAt.toISOString(),
    finished_at: status === 'running' ? null : finishedAt.toISOString(),
    last_step: lastStep,
  }
}

/** Newest start first, as the mock sorts them. */
export const LIST_JOBS: readonly FixtureJob[] = [
  job('job_8a21f6c3', 'vits-ja-v3-lr2e4', 'running', '09-24 10:12', '04:20:00', 84200, {
    learning_rate: 0.0002,
  }),
  job('job_7b32e5d4', 'vits-ja-v3-speaker128', 'running', '09-24 09:45', '04:47:00', 76800, {
    n_speakers: 128,
  }),
  job('job_6c43d4e5', 'vits-ja-v3-noise-scale', 'running', '09-24 08:30', '06:02:00', 112400, {
    noise_scale: 0.667,
  }),
  job('job_5d54c3f6', 'vits-ja-v2-baseline', 'finished', '09-23 18:00', '12:24:00', 240000, {}),
  job('job_4e65b2a7', 'vits-ja-v3-batch64', 'failed', '09-23 16:20', '00:18:00', 1600, {
    batch_size: 64,
  }),
  job('job_3f76a1b8', 'vits-ja-v2-lr1e4', 'finished', '09-23 12:40', '14:08:00', 240000, {
    learning_rate: 0.0001,
  }),
  job('job_2a87f0c9', 'vits-ja-v2-phoneme', 'finished', '09-22 22:15', '11:36:00', 240000, {
    text_frontend: 'phoneme',
  }),
  job('job_1b98e9d0', 'vits-ja-v2-warmup2k', 'finished', '09-22 18:05', '13:42:00', 240000, {
    warmup_steps: 2000,
  }),
  job('job_0c19d8e1', 'vits-ja-v2-dropout01', 'finished', '09-22 08:40', '12:51:00', 240000, {
    dropout: 0.1,
  }),
  job('job_fd20c7f2', 'vits-ja-v2-mel80', 'finished', '09-21 20:10', '13:05:00', 240000, {
    n_mels: 80,
  }),
  job('job_ee31b6a3', 'vits-ja-v2-adamw', 'finished', '09-21 09:30', '12:17:00', 240000, {
    optimizer: 'adamw',
  }),
  job('job_df42a5b4', 'vits-ja-v1-baseline', 'finished', '09-20 15:00', '15:33:00', 240000, {}),
]

/** project-jobs.html: "8件表示 · 先頭 · 続きあり". */
const FIRST_PAGE = 8

const isJobStatus = (value: string | null): value is JobStatus =>
  JOB_STATUSES.some((status) => status === value)

/** `?scenario=empty`: the project has no jobs yet (project-jobs-empty.html). */
export const JOBS_EMPTY_SCENARIO = 'empty'

/**
 * PATCH .../jobs/:job_id overlay (name only, `null` clears it) and DELETE
 * .../jobs/:job_id overlay, kept here rather than in job-detail.ts: that
 * module imports LIST_JOBS from here, and job-detail.ts's own DETAIL_JOBS go
 * through the same two helpers below, so both call sites share one place for
 * the mutable state.
 */
const EDITED_NAMES: Map<string, string | null> = new Map()
const DELETED_JOBS: Set<string> = new Set()

export const isJobDeleted = (jobId: string): boolean => DELETED_JOBS.has(jobId)

export const withJobOverrides = <T extends { id: string; name: string | null }>(job: T): T => {
  const name = EDITED_NAMES.get(job.id)
  return name === undefined ? job : { ...job, name }
}

export const setJobName = (jobId: string, name: string | null): void => {
  EDITED_NAMES.set(jobId, name)
}

export const deleteJobFixture = (jobId: string): void => {
  DELETED_JOBS.add(jobId)
}

export const listJobs: FixtureHandler = ({ params, url, scenario }) => {
  if (params.project_id !== VITS_PROJECT_ID || scenario === JOBS_EMPTY_SCENARIO) {
    return json({ items: [], next_cursor: null })
  }
  const status = url.searchParams.get('status')
  const rows = (isJobStatus(status) ? LIST_JOBS.filter((row) => row.status === status) : LIST_JOBS)
    .filter((row) => !isJobDeleted(row.id))
    .map(withJobOverrides)
  return json(paginate(rows, url, FIRST_PAGE))
}
