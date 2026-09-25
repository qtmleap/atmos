// One job and what hangs off it: GET .../jobs/:job_id, .../metrics, .../logs,
// .../media, .../media/:media_id and POST .../finish.
//
// Two jobs are drawn in full by the mocks, both named vits-baseline-042:
//   - designs/pages/job-detail.html         running, id job_vits_baseline_042
//   - designs/pages/job-detail-failed.html  failed,  id job_vits_baseline_042_failed
// Both started 2026-09-24 06:00:00 UTC and last reported step 48,000 of
// 200,000 at 09:42:18 (train/loss 0.1824, val/loss 0.2108, lr 1.20e-4,
// grad_norm 1.842); the failed one ended at 09:42:24 on a CUDA OOM.
// Their metric series are the mock's polylines read back into values.
//
// The list jobs of jobs.ts also open, with series from compare-series.ts and
// no logs or media.
import dayjs from 'dayjs'
import {
  FINISHED_JOB_STATUSES,
  type FinishJobRequest,
  type Job,
  type LogLine,
  type MediaAsset,
  type MediaKind,
  type Metric,
  type Page,
  type UpdateJobRequest,
} from '../../src/shared/types'
import { COMPARE_SERIES, type SeriesPoints } from './compare-series'
import { deleteJobFixture, isJobDeleted, LIST_JOBS, setJobName, withJobOverrides } from './jobs'
import { ME } from './me'
import { VITS_PROJECT_ID } from './projects'
import {
  afterSerial,
  apiError,
  binary,
  type FixtureHandler,
  json,
  noContent,
  notFound,
  paginate,
  readLimit,
} from './respond'

export const RUNNING_JOB_ID = 'job_vits_baseline_042'
export const FAILED_JOB_ID = 'job_vits_baseline_042_failed'

const STARTED_AT = '2026-09-24T06:00:00Z'
const LAST_RECEIVED_AT = '2026-09-24T09:42:18Z'
const FAILED_AT = '2026-09-24T09:42:24Z'
const LAST_STEP = 48000

/** The eight rows of the mock's config table, in its order. */
const CONFIG = {
  model: 'vits',
  dataset: 'jsut-v1.1',
  sample_rate: 22050,
  batch_size: 32,
  learning_rate: 0.0003,
  seed: 42,
  max_steps: 200000,
  fp16: true,
}

const baselineJob = (id: string, failed: boolean): Job => ({
  id,
  project_id: VITS_PROJECT_ID,
  name: 'vits-baseline-042',
  status: failed ? 'failed' : 'running',
  config: CONFIG,
  created_by: ME.id,
  started_at: STARTED_AT,
  finished_at: failed ? FAILED_AT : null,
})

const DETAIL_JOBS: readonly Job[] = [
  baselineJob(RUNNING_JOB_ID, false),
  baselineJob(FAILED_JOB_ID, true),
]

const withoutListFields = ({ last_step: _step, ...rest }: (typeof LIST_JOBS)[number]): Job => rest

export const findJob = (projectId: string, jobId: string): Job | undefined => {
  if (projectId !== VITS_PROJECT_ID || isJobDeleted(jobId)) {
    return undefined
  }
  const detail = DETAIL_JOBS.find((row) => row.id === jobId)
  if (detail !== undefined) {
    return withJobOverrides(detail)
  }
  const listed = LIST_JOBS.find((row) => row.id === jobId)
  return listed === undefined ? undefined : withJobOverrides(withoutListFields(listed))
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/** A mock chart: its polyline, x range (pixels for step 0..maxStep), y range (pixels for lo..hi). */
interface Polyline {
  points: string
  x: readonly [number, number]
  maxStep: number
  y: readonly [bottom: number, top: number]
  value: readonly [lo: number, hi: number]
}

const readPolyline = ({ points, x, maxStep, y, value }: Polyline): SeriesPoints =>
  points.split(' ').map((pair) => {
    const [px = 0, py = 0] = pair.split(',').map(Number)
    const step = ((px - x[0]) / (x[1] - x[0])) * maxStep
    const ratio = (y[0] - py) / (y[0] - y[1])
    return [step, value[0] + ratio * (value[1] - value[0])] as const
  })

// job-detail.html: loss charts span y 144..24 for 0.1..1.0, lr 144..24 for
// 0..3e-4, grad_norm 144..24 for 0..6; x spans step 0..48,000.
const TRAIN_LOSS = readPolyline({
  points:
    '44,35 61,48 78,43 94,64 110,60 127,82 144,78 160,94 177,90 193,102 210,98 226,111 243,107 259,118 276,114 292,124 309,119 325,127 342,124 358,130 375,126 391,132 408,130 424,134 440,133',
  x: [44, 440],
  maxStep: LAST_STEP,
  y: [144, 24],
  value: [0.1, 1.0],
})
const VAL_LOSS = readPolyline({
  points:
    '44,27 77,40 110,49 143,68 176,78 209,89 242,96 275,106 308,113 341,118 374,121 407,126 440,129',
  x: [44, 440],
  maxStep: LAST_STEP,
  y: [144, 24],
  value: [0.1, 1.0],
})
const LR = readPolyline({
  points:
    '52,144 84,24 116,25 148,29 180,35 212,43 244,52 276,62 308,73 340,81 372,87 404,93 440,96',
  x: [52, 440],
  maxStep: LAST_STEP,
  y: [144, 24],
  value: [0, 3e-4],
})
const GRAD_NORM = readPolyline({
  points:
    '44,40 64,80 84,56 104,95 124,73 144,90 164,102 184,75 204,98 224,105 244,92 264,108 284,101 304,109 324,96 344,110 364,102 384,111 404,106 424,110 440,107',
  x: [44, 440],
  maxStep: LAST_STEP,
  y: [144, 24],
  value: [0, 6],
})

/** Linear interpolation of `line` at `step` (clamped to its ends). */
const valueAt = (line: SeriesPoints, step: number): number => {
  const nextIndex = line.findIndex(([at]) => at >= step)
  const next = line[nextIndex]
  const previous = line[nextIndex - 1]
  if (next === undefined) {
    const last = line.at(-1)
    return last === undefined ? 0 : last[1]
  }
  if (previous === undefined || next[0] === previous[0]) {
    return next[1]
  }
  const ratio = (step - previous[0]) / (next[0] - previous[0])
  return previous[1] + ratio * (next[1] - previous[1])
}

/** `line` sampled every `every` steps up to `lastStep`, ending on the exact `last` value. */
const resample = (
  line: SeriesPoints,
  every: number,
  lastStep: number,
  last: number,
): SeriesPoints =>
  Array.from({ length: Math.floor(lastStep / every) + 1 }, (_, index) => index * every).map(
    (step) =>
      [step, step === lastStep ? last : Number(valueAt(line, step).toPrecision(4))] as const,
  )

const BASELINE_SERIES: Readonly<Record<string, SeriesPoints>> = {
  'train/loss': resample(TRAIN_LOSS, 500, LAST_STEP, 0.1824),
  'val/loss': resample(VAL_LOSS, 2000, LAST_STEP, 0.2108),
  lr: resample(LR, 500, LAST_STEP, 1.2e-4),
  grad_norm: resample(GRAD_NORM, 500, LAST_STEP, 1.842),
}

/** Receive time of `step` on a run that reached `lastStep` at `lastAt`. */
const loggedAt = (startedAt: string, lastAt: string, lastStep: number, step: number): string => {
  const start = dayjs(startedAt)
  const span = dayjs(lastAt).diff(start, 'ms')
  return start.add(Math.round((span * step) / Math.max(lastStep, 1)), 'ms').toISOString()
}

/**
 * Rows ordered by step with serial ids, as the ingest endpoint would have stored
 * them. Within one step the rows follow the key order of `series` (the order its
 * keys are written in), so a chart drawn in first-logged order matches the mock.
 */
const toMetrics = (
  jobId: string,
  series: Readonly<Record<string, SeriesPoints>>,
  startedAt: string,
  lastAt: string,
): Metric[] => {
  const flat = Object.entries(series).flatMap(([key, points], order) =>
    points.map(([step, value]) => ({ key, order, step: Math.round(step), value })),
  )
  const lastStep = flat.reduce((max, row) => Math.max(max, row.step), 0)
  return flat
    .sort((a, b) => (a.step === b.step ? a.order - b.order : a.step - b.step))
    .map((row, index) => ({
      id: String(index + 1),
      job_id: jobId,
      step: row.step,
      key: row.key,
      value: row.value,
      logged_at: loggedAt(startedAt, lastAt, lastStep, row.step),
    }))
}

const metricsOf = (job: Job): Metric[] => {
  if (job.id === RUNNING_JOB_ID || job.id === FAILED_JOB_ID) {
    return toMetrics(job.id, BASELINE_SERIES, STARTED_AT, LAST_RECEIVED_AT)
  }
  const series = job.name === null ? undefined : COMPARE_SERIES[job.name]
  const lastAt = job.finished_at === null ? '2026-09-24T14:32:00Z' : job.finished_at
  return series === undefined ? [] : toMetrics(job.id, series, job.started_at, lastAt)
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

type LogSpec = readonly [time: string, stream: LogLine['stream'], message: string]

const RUNNING_LOGS: readonly LogSpec[] = [
  ['09:42:00.125', 'stdout', '[eval] validation started: 128 samples'],
  ['09:42:08.731', 'stdout', '[eval] step=48000 val/loss=0.2108'],
  ['09:42:12.306', 'stdout', '[media] uploaded mel/generated, sample/generated'],
  ['09:42:18.092', 'stdout', '[train] step=48000 loss=0.1824 lr=0.0001200 grad_norm=1.842'],
]

const FAILED_LOGS: readonly LogSpec[] = [
  ...RUNNING_LOGS,
  ['09:42:23.804', 'stdout', '[train] epoch=156 step=48100 batch_size=32'],
  ['09:42:24.016', 'stderr', 'Traceback (most recent call last):'],
  ['09:42:24.016', 'stderr', '  File "/workspace/vits/train.py", line 287, in train_and_evaluate'],
  ['09:42:24.016', 'stderr', '    loss_gen_all.backward()'],
  [
    '09:42:24.017',
    'stderr',
    '  File "/opt/venv/lib/python3.11/site-packages/torch/_tensor.py", line 581, in backward',
  ],
  [
    '09:42:24.017',
    'stderr',
    '    torch.autograd.backward(self, gradient, retain_graph, create_graph)',
  ],
  [
    '09:42:24.018',
    'stderr',
    'torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 256.00 MiB.',
  ],
  [
    '09:42:24.018',
    'stderr',
    'GPU 0 has a total capacity of 23.69 GiB of which 112.25 MiB is free.',
  ],
  [
    '09:42:24.018',
    'stderr',
    'Including non-PyTorch memory, this process has 23.58 GiB memory in use.',
  ],
  ['09:42:24.124', 'stdout', '[atmos] run finished: status=failed'],
]

const toLogLines = (jobId: string, specs: readonly LogSpec[]): LogLine[] =>
  specs.map(([time, stream, message], index) => ({
    id: String(index + 1),
    job_id: jobId,
    stream,
    message,
    logged_at: `2026-09-24T${time}Z`,
  }))

const logsOf = (job: Job): LogLine[] =>
  job.id === RUNNING_JOB_ID
    ? toLogLines(job.id, RUNNING_LOGS)
    : job.id === FAILED_JOB_ID
      ? toLogLines(job.id, FAILED_LOGS)
      : []

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

// The mock's thumbnails are inline SVG; the same drawings are served as the
// image files, with its light-theme CSS variables written out.
const MUTED = 'oklch(0.97 0 0)'
const CHART_1 = 'oklch(0.646 0.222 41.116)'
const CHART_2 = 'oklch(0.6 0.118 184.704)'
const CHART_3 = 'oklch(0.398 0.07 227.392)'

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 120" width="560" height="240"><rect width="280" height="120" fill="${MUTED}"/>${body}</svg>`

const IMAGES: Readonly<Record<string, string>> = {
  'mel/generated': svg(
    `<g stroke="${CHART_3}" stroke-width="8" opacity=".6"><path d="M16 95V70M30 100V50M44 100V30M58 105V55M72 100V22M86 96V42M100 105V55M114 103V30M128 106V46M142 105V20M156 100V35M170 100V50M184 104V60M198 103V40M212 99V53M226 100V30M240 105V60M254 100V80"/></g><g stroke="${CHART_1}" stroke-width="3" fill="none"><path d="M14 87 44 80 74 85 104 77 134 80 164 73 194 78 224 70 258 84M14 70 44 63 74 67 104 58 134 63 164 55 194 61 224 52 258 67"/></g>`,
  ),
  'mel/reference': svg(
    `<g stroke="${CHART_3}" stroke-width="8" opacity=".6"><path d="M16 95V75M30 100V55M44 100V34M58 105V50M72 100V25M86 96V39M100 105V50M114 103V35M128 106V40M142 105V25M156 100V33M170 100V52M184 104V55M198 103V43M212 99V50M226 100V36M240 105V63M254 100V76"/></g><g stroke="${CHART_2}" stroke-width="3" fill="none"><path d="M14 86 44 81 74 83 104 78 134 79 164 74 194 77 224 72 258 82M14 69 44 64 74 65 104 60 134 61 164 56 194 59 224 54 258 65"/></g>`,
  ),
  alignment: svg(
    `<g fill="${CHART_3}"><rect x="20" y="90" width="30" height="10"/><rect x="48" y="80" width="25" height="10"/><rect x="70" y="70" width="40" height="10"/><rect x="108" y="60" width="25" height="10"/><rect x="130" y="50" width="40" height="10"/><rect x="168" y="40" width="30" height="10"/><rect x="195" y="30" width="36" height="10"/><rect x="229" y="20" width="30" height="10"/></g>`,
  ),
}

const SAMPLE_RATE = 22050
/** "0:00 / 0:08" */
const AUDIO_SECONDS = 8

/** A silent 16-bit mono WAV of the mock's length, so the player shows 0:08. */
const silentWav = (): Uint8Array => {
  const dataBytes = SAMPLE_RATE * AUDIO_SECONDS * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const ascii = (offset: number, text: string) => {
    for (const [index, char] of [...text].entries()) {
      view.setUint8(offset + index, char.charCodeAt(0))
    }
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)
  return new Uint8Array(buffer)
}

const WAV = silentWav()

const mediaUrl = (jobId: string, mediaId: string): string =>
  `/api/projects/${VITS_PROJECT_ID}/jobs/${jobId}/media/${mediaId}`

const asset = (
  jobId: string,
  id: string,
  kind: MediaKind,
  label: string,
  contentType: string,
  size: number,
  at: string,
): MediaAsset => ({
  id,
  job_id: jobId,
  step: LAST_STEP,
  kind,
  label,
  content_type: contentType,
  size,
  url: mediaUrl(jobId, id),
  logged_at: at,
})

const mediaOf = (job: Job): MediaAsset[] =>
  job.id === RUNNING_JOB_ID || job.id === FAILED_JOB_ID
    ? [
        asset(
          job.id,
          'med_mel_generated',
          'image',
          'mel/generated',
          'image/png',
          48213,
          '2026-09-24T09:42:12.306Z',
        ),
        asset(
          job.id,
          'med_mel_reference',
          'image',
          'mel/reference',
          'image/png',
          47890,
          '2026-09-24T09:42:12.306Z',
        ),
        asset(
          job.id,
          'med_alignment',
          'image',
          'alignment',
          'image/png',
          21504,
          '2026-09-24T09:42:12.306Z',
        ),
        asset(
          job.id,
          'med_sample_generated',
          'audio',
          'sample/generated',
          'audio/wav',
          WAV.byteLength,
          '2026-09-24T09:42:12.306Z',
        ),
      ]
    : []

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

type JobHandler = (job: Job, request: Parameters<FixtureHandler>[0]) => ReturnType<FixtureHandler>

const withJob =
  (handler: JobHandler): FixtureHandler =>
  (request) => {
    const job = findJob(String(request.params.project_id), String(request.params.job_id))
    return job === undefined ? notFound(`job ${request.params.job_id}`) : handler(job, request)
  }

export const getJob: FixtureHandler = withJob((job) => json(job))

/** `cursor` is the last id received (serial ids, `id > cursor`), like the real endpoint. */
export const listMetrics: FixtureHandler = withJob((job, { url }) => {
  const key = url.searchParams.get('key')
  const sinceStep = url.searchParams.get('since_step')
  const rows = afterSerial(metricsOf(job), url.searchParams.get('cursor')).filter(
    (row) =>
      (key === null || row.key === key) && (sinceStep === null || row.step >= Number(sinceStep)),
  )
  const limit = readLimit(url)
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  const page: Page<Metric> = {
    items,
    next_cursor: rows.length > limit && last !== undefined ? last.id : null,
  }
  return json(page)
})

/** `before` / `after` cursors by id; the fixture logs always fit one page. */
export const listLogs: FixtureHandler = withJob((job, { url }) => {
  const before = url.searchParams.get('before')
  const after = url.searchParams.get('after')
  const items = logsOf(job).filter(
    (line) =>
      (before === null || Number(line.id) < Number(before)) &&
      (after === null || Number(line.id) > Number(after)),
  )
  const page: Page<LogLine> = { items, next_cursor: null }
  return json(page)
})

export const listMedia: FixtureHandler = withJob((job, { url }) => {
  const kind = url.searchParams.get('kind')
  const rows = mediaOf(job).filter((row) => kind === null || row.kind === kind)
  return json(paginate(rows, url))
})

export const getMediaFile: FixtureHandler = withJob((job, { params }) => {
  const found = mediaOf(job).find((row) => row.id === params.media_id)
  if (found === undefined) {
    return notFound(`media ${params.media_id}`)
  }
  if (found.kind === 'audio') {
    return binary('audio/wav', WAV)
  }
  const drawing = IMAGES[found.label]
  return drawing === undefined ? notFound(`media ${found.id}`) : binary('image/svg+xml', drawing)
})

const isFinishJobRequest = (value: unknown): value is FinishJobRequest =>
  typeof value === 'object' &&
  value !== null &&
  'status' in value &&
  FINISHED_JOB_STATUSES.some((status) => status === value.status)

/** Echoes the finished job without storing it: the fixtures are read-only. */
export const finishJob: FixtureHandler = withJob(async (job, { json: body }) => {
  const request = await body()
  if (!isFinishJobRequest(request)) {
    return apiError(400, 'validation_error', 'status must be finished or failed')
  }
  return json({ ...job, status: request.status, finished_at: '2026-09-24T14:32:00Z' })
})

const isUpdateJobRequest = (value: unknown): value is UpdateJobRequest =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  (value.name === null || (typeof value.name === 'string' && value.name !== ''))

/**
 * Persists into jobs.ts's EDITED_NAMES overlay: the job detail page re-reads
 * the job after saving.
 */
export const updateJob: FixtureHandler = withJob(async (job, { json: body }) => {
  const request = await body()
  if (!isUpdateJobRequest(request)) {
    return apiError(400, 'validation_error', 'name must be a non-empty string or null')
  }
  setJobName(job.id, request.name)
  return json({ ...job, name: request.name })
})

/** Marks the job deleted in jobs.ts's DELETED_JOBS overlay. */
export const deleteJob: FixtureHandler = withJob((job) => {
  deleteJobFixture(job.id)
  return noContent()
})

/** Whether `.../live` should be accepted (and then left silent) for these ids. */
export const isLiveJob = (projectId: string, jobId: string): boolean => {
  const job = findJob(projectId, jobId)
  return job !== undefined && job.status === 'running'
}
