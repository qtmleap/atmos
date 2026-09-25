// The line under the job list and the comparison (`.between.list-footer` of
// project-jobs.html): what the step column means, and when the page was drawn.
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

/** `2026-09-24 14:32 UTC` */
const formatObservedAt = (iso: string): string => dayjs.utc(iso).format('YYYY-MM-DD HH:mm [UTC]')

export function JobsFootnote({ now }: { now: string }) {
  return (
    <div className="flex items-center justify-between gap-4 pt-3 text-xs text-muted-foreground">
      <p>ステップは各ジョブの最終受信値です。実行中のものは表示時点まで。</p>
      <span>表示時点 {formatObservedAt(now)}</span>
    </div>
  )
}
