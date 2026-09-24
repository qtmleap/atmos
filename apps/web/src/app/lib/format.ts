// Display formatting shared by the pages. All inputs are SPEC wire values
// (ISO 8601 UTC strings, byte counts, metric numbers).
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { JobStatus, Visibility } from '@/shared/types'

dayjs.extend(utc)

/** Local date and time, minute precision: `2026-09-24 21:00`. */
export const formatDateTime = (iso: string): string => dayjs(iso).format('YYYY-MM-DD HH:mm')

/** UTC month, day and time for dense list columns: `09-24 14:32`. */
export const formatShortDateTimeUtc = (iso: string): string => dayjs.utc(iso).format('MM-DD HH:mm')

/** UTC date only: `2026-09-24`. */
export const formatDateUtc = (iso: string): string => dayjs.utc(iso).format('YYYY-MM-DD')

/** UTC date in Japanese: `2026年9月24日`. */
export const formatDateJaUtc = (iso: string): string => dayjs.utc(iso).format('YYYY年M月D日')

/** Count line of a paged list: `10件表示 · 先頭 · 続きあり` / `5件表示 · すべて表示しました`. */
export const formatListCount = (count: number, hasMore: boolean): string =>
  hasMore ? `${count}件表示 · 先頭 · 続きあり` : `${count}件表示 · すべて表示しました`

/** Local time with seconds, for log lines: `21:00:05`. */
export const formatClock = (iso: string): string => dayjs(iso).format('HH:mm:ss')

/** Local date only: `2026-09-24`. */
export const formatDate = (iso: string): string => dayjs(iso).format('YYYY-MM-DD')

/**
 * Elapsed time between two instants as `HH:mm:ss` (`04:30:00`); hours keep
 * counting past 24 (`27:05:09`). `endIso` null means "still running" and
 * measures up to `nowIso`.
 */
export const formatDuration = (startIso: string, endIso: string | null, nowIso: string): string => {
  const end = endIso === null ? dayjs(nowIso) : dayjs(endIso)
  const totalSeconds = Math.max(0, end.diff(dayjs(startIso), 'second'))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const

export const formatBytes = (bytes: number): string => {
  const exponent = Math.min(
    BYTE_UNITS.length - 1,
    bytes <= 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(1024)),
  )
  const value = bytes / 1024 ** exponent
  const unit = BYTE_UNITS[exponent]
  return exponent === 0 ? `${bytes} ${unit}` : `${value.toFixed(1)} ${unit}`
}

/** Compact metric value: up to 4 significant digits, exponent form for extremes. */
export const formatMetricValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return String(value)
  }
  const magnitude = Math.abs(value)
  if (magnitude !== 0 && (magnitude < 1e-3 || magnitude >= 1e6)) {
    return value.toExponential(3)
  }
  return String(Number(value.toPrecision(4)))
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  running: '実行中',
  finished: '完了',
  failed: '失敗',
}

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: '公開',
  private: '非公開',
}

/** A job's display name; unnamed jobs show the head of their id. */
export const jobDisplayName = (job: { id: string; name: string | null }): string =>
  job.name === null || job.name === '' ? `名前なし ${job.id.slice(0, 8)}` : job.name
