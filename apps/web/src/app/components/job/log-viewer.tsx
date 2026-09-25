import { useId, useMemo, useState } from 'react'
import { useFollowScroll } from '../../hooks/use-follow-scroll'
import type { JobLogs } from '../../hooks/use-job-logs'
import { type JobPhase, logHeaderNote } from '../../lib/job-phase'
import {
  filterLogLines,
  isStreamFilter,
  STREAM_FILTER_LABELS,
  STREAM_FILTERS,
  type StreamFilter,
} from '../../lib/log-state'
import { Button } from '../ui/button'
import { EmptyState, EmptyStateDescription } from '../ui/empty-state'
import { NativeSelect, NativeSelectOption } from '../ui/native-select'
import { formatUtcClock, formatUtcDateTime } from './format-utc'
import { LogLines } from './log-lines'

export interface LogViewerProps {
  logs: JobLogs
  phase: JobPhase
  /** `finished_at` of a failed job, for the closing note. */
  finishedAt: string | null
  /** When the newest line was received, for the closing note. */
  lastReceivedAt: string | null
}

/** The logs tab: stream filter, the lines (following their tail), paging and a note. */
export function LogViewer({ logs, phase, finishedAt, lastReceivedAt }: LogViewerProps) {
  const [stream, setStream] = useState<StreamFilter>('all')
  const lines = useMemo(() => filterLogLines(logs.lines, stream), [logs.lines, stream])
  const scroll = useFollowScroll<HTMLDivElement>(lines.at(0)?.id, lines.length)
  const selectId = useId()
  const oldest = lines.at(0)

  return (
    <section aria-label="実行ログ">
      <div className="flex items-center justify-between gap-4 border-b py-3">
        <div className="flex items-center gap-3">
          <h2>実行ログ</h2>
          <label htmlFor={selectId} className="sr-only">
            出力ストリーム
          </label>
          <NativeSelect
            id={selectId}
            className="w-40"
            value={stream}
            onChange={(event) =>
              isStreamFilter(event.target.value) && setStream(event.target.value)
            }
          >
            {STREAM_FILTERS.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {STREAM_FILTER_LABELS[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <span className="text-xs text-muted-foreground">
          {logHeaderNote(phase, scroll.following)}
        </span>
      </div>
      {logs.hasOlder || logs.error !== null ? (
        <div className="flex items-center justify-between gap-4 py-3">
          <Button
            variant="outline"
            onClick={logs.error === null ? logs.loadOlder : logs.retry}
            disabled={logs.loading !== null}
            aria-busy={logs.loading === 'older' ? 'true' : undefined}
          >
            {logs.loading === 'older'
              ? '過去のログを読み込み中…'
              : logs.error === null
                ? '過去のログを読み込む'
                : 'もう一度試す'}
          </Button>
          {logs.error === null ? (
            <span className="text-xs text-muted-foreground">
              {oldest === undefined ? '' : `${formatUtcClock(oldest.logged_at)} より前`}
            </span>
          ) : (
            <span role="alert" className="text-xs text-destructive">
              {logs.error}
            </span>
          )}
        </div>
      ) : null}
      <LogLines
        ref={scroll.ref}
        onScroll={scroll.onScroll}
        lines={lines}
        density="compact"
        className="max-h-[70dvh] overflow-y-auto"
        empty={
          logs.loading === 'initial' ? (
            <p className="py-3 text-xs text-muted-foreground">ログを読み込んでいます。</p>
          ) : (
            <EmptyState>
              <h3>ログはまだありません</h3>
              <EmptyStateDescription>
                SDKから送信されたログをここに表示します。
              </EmptyStateDescription>
            </EmptyState>
          )
        }
      />
      {scroll.following ? null : (
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-xs text-muted-foreground">
            追従停止中 · 過去のログを表示しています
          </span>
          <Button variant="secondary" onClick={scroll.jumpToBottom}>
            最新のログへ
          </Button>
        </div>
      )}
      <p className="mt-3.5 text-xs text-muted-foreground">
        {phase !== 'failed' || finishedAt === null
          ? `最終受信 ${lastReceivedAt === null ? '—' : formatUtcClock(lastReceivedAt)} · stdout / stderr`
          : `終了 ${formatUtcDateTime(finishedAt)} · 受信済みのメトリクス・メディアは引き続き閲覧できます。`}
      </p>
    </section>
  )
}
