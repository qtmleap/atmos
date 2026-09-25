import type { Job, ProjectOwner } from '@/shared/types'
import { ConfigTable } from './config-table'
import { formatUtcClock } from './format-utc'
import { WidgetHeader } from './widget-header'

export interface JobSidebarProps {
  job: Job
  creator: ProjectOwner | null
}

/** The right column: the config table and the run's who/when. */
export function JobSidebar({ job, creator }: JobSidebarProps) {
  return (
    <aside aria-label="ジョブの設定" className="border-l pl-6">
      <WidgetHeader
        level={2}
        title="設定"
        aside={<span className="text-xs text-muted-foreground">config</span>}
      />
      <ConfigTable config={job.config} />
      <p className="mt-3.5 text-xs text-muted-foreground">
        ジョブ開始時の設定。
        <br />
        SDK から送信された値を表示します。
      </p>
      <WidgetHeader title="実行情報" />
      <p className="mt-3.5 text-xs text-muted-foreground">
        実行者　{creator === null ? '—' : creator.display_name}
        <br />
        開始　{formatUtcClock(job.started_at)}
        <br />
        終了　{job.finished_at === null ? '—（実行中）' : formatUtcClock(job.finished_at)}
      </p>
    </aside>
  )
}
