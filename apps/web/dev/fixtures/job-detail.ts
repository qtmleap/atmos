// One job and what hangs off it: GET .../jobs/:job_id, .../metrics, .../logs,
// .../media, .../media/:media_id and POST .../finish.
//
// Four jobs are drawn in full by the mocks, all named vits-baseline-042 and
// started 2026-09-24 06:00:00 UTC:
//   - designs/pages/job-detail.html           running,  id job_vits_baseline_042
//   - designs/pages/job-detail-failed.html    failed,   id job_vits_baseline_042_failed
//   - designs/pages/job-detail-finished.html  finished, id job_vits_baseline_042_finished
//   - designs/pages/job-detail-waiting.html   running,  id job_vits_baseline_042_waiting
// The running and failed ones last reported step 48,000 of 200,000 at
// 09:42:18 (train/loss 0.1824, val/loss 0.2108, lr 1.20e-4, grad_norm 1.842);
// the failed one ended at 09:42:24 on a CUDA OOM. The finished one ran the
// same curves out to step 200,000 and ended at 21:30:00. The waiting one has
// reported nothing yet. The metric series are the mock's polylines read back
// into values.
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
  type Metric,
  type Page,
  type UpdateJobRequest,
} from '../../src/shared/types'
import { COMPARE_SERIES, type SeriesPoints } from './compare-series'
import { FAILED_LOGS, FINISHED_LOGS, type LogSpec, RUNNING_LOGS, toLogLines } from './job-logs'
import { baselineMedia, mediaFile } from './job-media'
import { deleteJobFixture, isJobDeleted, LIST_JOBS, setJobName, withJobOverrides } from './jobs'
import { ME } from './me'
import { VITS_PROJECT_ID } from './projects'
import {
  afterSerial,
  apiError,
  type FixtureHandler,
  json,
  noContent,
  notFound,
  paginate,
  readLimit,
  type Scenario,
} from './respond'

export const RUNNING_JOB_ID = 'job_vits_baseline_042'
export const FAILED_JOB_ID = 'job_vits_baseline_042_failed'
export const FINISHED_JOB_ID = 'job_vits_baseline_042_finished'
export const WAITING_JOB_ID = 'job_vits_baseline_042_waiting'

const STARTED_AT = '2026-09-24T06:00:00Z'
const LAST_RECEIVED_AT = '2026-09-24T09:42:18Z'
const FAILED_AT = '2026-09-24T09:42:24Z'
const LAST_STEP = 48000
const FINISHED_AT = '2026-09-24T21:30:00Z'
const FINISHED_LAST_METRIC_AT = '2026-09-24T21:29:18.092Z'
const FINISHED_STEP = 200000

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

const baselineJob = (id: string, status: Job['status'], finishedAt: string | null): Job => ({
  id,
  project_id: VITS_PROJECT_ID,
  name: 'vits-baseline-042',
  status,
  config: CONFIG,
  created_by: ME.id,
  started_at: STARTED_AT,
  finished_at: finishedAt,
})

const DETAIL_JOBS: readonly Job[] = [
  baselineJob(RUNNING_JOB_ID, 'running', null),
  baselineJob(FAILED_JOB_ID, 'failed', FAILED_AT),
  baselineJob(FINISHED_JOB_ID, 'finished', FINISHED_AT),
  baselineJob(WAITING_JOB_ID, 'running', null),
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

// Traced from job-detail.html's earlier axes: loss charts span y 144..24 for
// 0.1..1.0, lr 144..24 for 0..3e-4, grad_norm 144..24 for 0..6; x spans step
// 0..48,000.
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

/** `series` with every step stretched by `factor`, keeping the values. */
const stretch = (
  series: Readonly<Record<string, SeriesPoints>>,
  factor: number,
): Record<string, SeriesPoints> =>
  Object.fromEntries(
    Object.entries(series).map(([key, points]) => [
      key,
      points.map(([step, value]) => [step * factor, value] as const),
    ]),
  )

/** The baseline curves drawn over 200,000 steps, as the finished mock does. */
const FINISHED_SERIES = stretch(BASELINE_SERIES, FINISHED_STEP / LAST_STEP)

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

/** `?scenario=value-head`: every job also logs a value head's loss and sign accuracy. */
export const VALUE_HEAD_SCENARIO = 'value-head'

/** Deterministic wobble in -1..1, so reloads draw the same curve. */
const wobble = (step: number, seed: number): number =>
  Math.sin(step * 0.00037 + seed * 1.7) * 0.6 + Math.sin(step * 0.0011 + seed) * 0.4

/**
 * train/value (falls from 0.42 toward 0.11) and train/value_sign (rises from
 * 0.55 toward 0.86), on the steps `base` was logged at.
 */
const valueHeadSeries = (base: SeriesPoints): Record<string, SeriesPoints> => {
  const lastStep = base.reduce((max, [step]) => Math.max(max, step), 1)
  const progress = (step: number): number => 1 - Math.exp((-3 * step) / lastStep)
  return {
    'train/value': base.map(
      ([step]) =>
        [
          step,
          Number((0.42 - 0.31 * progress(step) + 0.012 * wobble(step, 1)).toPrecision(4)),
        ] as const,
    ),
    'train/value_sign': base.map(
      ([step]) =>
        [
          step,
          Number((0.55 + 0.31 * progress(step) + 0.01 * wobble(step, 2)).toPrecision(4)),
        ] as const,
    ),
  }
}

const seriesOf = (job: Job): Readonly<Record<string, SeriesPoints>> | undefined => {
  if (job.id === RUNNING_JOB_ID || job.id === FAILED_JOB_ID) {
    return BASELINE_SERIES
  }
  if (job.id === FINISHED_JOB_ID) {
    return FINISHED_SERIES
  }
  return job.name === null ? undefined : COMPARE_SERIES[job.name]
}

const lastMetricAt = (job: Job): string => {
  if (job.id === RUNNING_JOB_ID || job.id === FAILED_JOB_ID) {
    return LAST_RECEIVED_AT
  }
  if (job.id === FINISHED_JOB_ID) {
    return FINISHED_LAST_METRIC_AT
  }
  return job.finished_at === null ? '2026-09-24T14:32:00Z' : job.finished_at
}

const metricsOf = (job: Job, scenario: Scenario): Metric[] => {
  const series = seriesOf(job)
  if (series === undefined) {
    return []
  }
  const base = series['train/loss']
  const withValueHead =
    scenario === VALUE_HEAD_SCENARIO && base !== undefined
      ? { ...series, ...valueHeadSeries(base) }
      : series
  return toMetrics(job.id, withValueHead, job.started_at, lastMetricAt(job))
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

const logSpecsOf = (jobId: string): readonly LogSpec[] => {
  switch (jobId) {
    case RUNNING_JOB_ID:
      return RUNNING_LOGS
    case FAILED_JOB_ID:
      return FAILED_LOGS
    case FINISHED_JOB_ID:
      return FINISHED_LOGS
    default:
      return []
  }
}

const logsOf = (job: Job): LogLine[] => toLogLines(job.id, logSpecsOf(job.id))

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

const mediaOf = (job: Job): MediaAsset[] =>
  job.id === FINISHED_JOB_ID
    ? baselineMedia(job.id, FINISHED_STEP, '2026-09-24T21:29:12.306Z')
    : job.id === RUNNING_JOB_ID || job.id === FAILED_JOB_ID
      ? baselineMedia(job.id, LAST_STEP, '2026-09-24T09:42:12.306Z')
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

/** `?scenario=no-metrics`: no job has logged a metric (project-jobs-compare-no-metrics.html). */
export const NO_METRICS_SCENARIO = 'no-metrics'

/** `cursor` is the last id received (serial ids, `id > cursor`), like the real endpoint. */
export const listMetrics: FixtureHandler = withJob((job, { url, scenario }) => {
  if (scenario === NO_METRICS_SCENARIO) {
    const empty: Page<Metric> = { items: [], next_cursor: null }
    return json(empty)
  }
  const key = url.searchParams.get('key')
  const sinceStep = url.searchParams.get('since_step')
  const rows = afterSerial(metricsOf(job, scenario), url.searchParams.get('cursor')).filter(
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
  return mediaFile(found)
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
 * Persists into jobs.ts's EDITED_NAMES overlay, like createProject persists
 * into CREATED: the job detail page re-reads the job after saving.
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
