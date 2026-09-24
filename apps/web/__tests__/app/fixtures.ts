// Wire objects for the SPA tests, in the docs/SPEC.md §1 shapes.
import type { Job, LogLine, MediaAsset, Metric, Project } from '../../src/shared/types'

export const JOB_ID = '00000000-0000-4000-8000-00000000000a'
export const PROJECT_ID = '00000000-0000-4000-8000-00000000000b'

export const metric = (id: number, key: string, step: number, value: number): Metric => ({
  id: String(id),
  job_id: JOB_ID,
  step,
  key,
  value,
  logged_at: '2026-09-24T00:00:00.000Z',
})

export const logLine = (
  id: number,
  message = `line ${id}`,
  stream: LogLine['stream'] = 'stdout',
): LogLine => ({
  id: String(id),
  job_id: JOB_ID,
  stream,
  message,
  logged_at: '2026-09-24T00:00:00.000Z',
})

export const media = (
  id: string,
  label: string,
  step: number,
  kind: MediaAsset['kind'] = 'image',
): MediaAsset => ({
  id,
  job_id: JOB_ID,
  step,
  kind,
  label,
  content_type: kind === 'image' ? 'image/png' : 'audio/wav',
  size: 2048,
  url: `/api/projects/${PROJECT_ID}/jobs/${JOB_ID}/media/${id}`,
  logged_at: `2026-09-24T00:00:${String(step % 60).padStart(2, '0')}.000Z`,
})

export const job = (overrides: Partial<Job> = {}): Job => ({
  id: JOB_ID,
  project_id: PROJECT_ID,
  name: 'exp1',
  status: 'finished',
  config: { lr: 0.001 },
  created_by: '00000000-0000-4000-8000-000000000001',
  started_at: '2026-09-24T00:00:00.000Z',
  finished_at: '2026-09-24T01:02:03.000Z',
  ...overrides,
})

export const project = (overrides: Partial<Project> = {}): Project => ({
  id: PROJECT_ID,
  name: '音声合成の実験',
  visibility: 'public',
  owner: { id: '00000000-0000-4000-8000-000000000001', handle: 'alice', display_name: 'Alice' },
  created_at: '2026-09-01T00:00:00.000Z',
  ...overrides,
})
