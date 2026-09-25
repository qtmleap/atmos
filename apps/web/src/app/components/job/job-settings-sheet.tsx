import { Settings2Icon } from 'lucide-react'
import type { Job, ProjectOwner } from '@/shared/types'
import { formatDuration } from '../../lib/format'
import { Button } from '../ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet'
import { ConfigTable, KeyValueTable } from './config-table'
import { formatUtcClock } from './format-utc'
import { WidgetHeader } from './widget-header'

export interface JobSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: Job
  creator: ProjectOwner | null
}

function runInfoRows(job: Job, creator: ProjectOwner | null) {
  const rows = [
    { key: '実行者', value: creator === null ? '—' : creator.display_name },
    { key: '開始', value: formatUtcClock(job.started_at) },
    {
      key: '終了',
      value: job.finished_at === null ? '—（実行中）' : formatUtcClock(job.finished_at),
    },
  ]
  if (job.status === 'finished' && job.finished_at !== null) {
    rows.push({
      key: '所要時間',
      value: formatDuration(job.started_at, job.finished_at, job.finished_at),
    })
  }
  return rows
}

/**
 * The header's "設定" button and the sheet it opens on the right
 * (designs/pages/job-detail-settings.html): the config table and the run's
 * who/when. Kept out of the page so the charts get the full width.
 */
export function JobSettingsSheet({ open, onOpenChange, job, creator }: JobSettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Settings2Icon />
          設定
        </Button>
      </SheetTrigger>
      <SheetContent side="right" size="sm" closeLabel="設定を閉じる" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>設定</SheetTitle>
        </SheetHeader>
        <ConfigTable config={job.config} />
        <WidgetHeader title="実行情報" />
        <KeyValueTable caption="実行情報" rows={runInfoRows(job, creator)} />
      </SheetContent>
    </Sheet>
  )
}
