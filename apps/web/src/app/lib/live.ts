// Client side of the per-job live channel (docs/SPEC.md §11).
import {
  JOB_STATUSES,
  type JobStatus,
  LIVE_CLOSE_CODES,
  type LiveMessage,
  LOG_STREAMS,
  type LogLine,
  MEDIA_KINDS,
  type MediaAsset,
  type Metric,
} from '@/shared/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number'
const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  options.some((option) => option === value)

const isMetric = (value: unknown): value is Metric =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.job_id) &&
  isNumber(value.step) &&
  isString(value.key) &&
  isNumber(value.value) &&
  isString(value.logged_at)

const isLogLine = (value: unknown): value is LogLine =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.job_id) &&
  isOneOf(LOG_STREAMS, value.stream) &&
  isString(value.message) &&
  isString(value.logged_at)

const isMediaAsset = (value: unknown): value is MediaAsset =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.job_id) &&
  isNumber(value.step) &&
  isOneOf(MEDIA_KINDS, value.kind) &&
  isString(value.label) &&
  isString(value.content_type) &&
  isNumber(value.size) &&
  isString(value.url) &&
  isString(value.logged_at)

const isStatusData = (value: unknown): value is { status: JobStatus; finished_at: string | null } =>
  isRecord(value) &&
  isOneOf(JOB_STATUSES, value.status) &&
  (value.finished_at === null || isString(value.finished_at))

/** Parses one text frame; anything not in the SPEC shape is null (and ignored). */
export const parseLiveMessage = (frame: string): LiveMessage | null => {
  const parsed: unknown = (() => {
    try {
      return JSON.parse(frame)
    } catch {
      return null
    }
  })()
  if (!isRecord(parsed)) {
    return null
  }
  const { type, data } = parsed
  if (type === 'metric' && isMetric(data)) {
    return { type, data }
  }
  if (type === 'log' && isLogLine(data)) {
    return { type, data }
  }
  if (type === 'media' && isMediaAsset(data)) {
    return { type, data }
  }
  if (type === 'status' && isStatusData(data)) {
    return { type, data }
  }
  return null
}

/** ws:// or wss:// URL of the live endpoint, on the page's own origin. */
export const liveUrl = (
  location: { protocol: string; host: string },
  projectId: string,
  jobId: string,
): string => {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${location.host}/api/projects/${encodeURIComponent(projectId)}/jobs/${encodeURIComponent(jobId)}/live`
}

/**
 * Whether to reconnect after a close. 1000 means the job ended (or we left);
 * 4403 and 4404 will not get better by retrying. Anything else (1006 from a
 * dropped connection, 1011 from a server error) is worth another try.
 */
export const shouldReconnect = (closeCode: number): boolean =>
  closeCode !== LIVE_CLOSE_CODES.normal &&
  closeCode !== LIVE_CLOSE_CODES.forbidden &&
  closeCode !== LIVE_CLOSE_CODES.notFound

/** Exponential backoff: 1 s, 2 s, 4 s ... capped at 30 s. */
export const reconnectDelay = (attempt: number): number => Math.min(30_000, 1000 * 2 ** attempt)
