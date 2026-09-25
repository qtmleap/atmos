import { Settings2Icon } from 'lucide-react'
import type { Job, ProjectOwner } from '@/shared/types'
import { formatDuration } from '../../lib/format'
import { Button } from '../ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet'
import { ConfigTable } from './config-table'
import { formatUtcClock } from './format-utc'
import { WidgetHeader } from './widget-header'

export interface JobSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: Job
  creator: ProjectOwner | null
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
      <SheetContent side="right" closeLabel="設定を閉じる" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>設定</SheetTitle>
        </SheetHeader>
        <ConfigTable config={job.config} />
        <WidgetHeader title="実行情報" />
        <p className="mt-3.5 text-xs text-muted-foreground">
          実行者　{creator === null ? '—' : creator.display_name}
          <br />
          開始　{formatUtcClock(job.started_at)}
          <br />
          終了　{job.finished_at === null ? '—（実行中）' : formatUtcClock(job.finished_at)}
          {job.status === 'finished' && job.finished_at !== null ? (
            <>
              <br />
              所要時間　{formatDuration(job.started_at, job.finished_at, job.finished_at)}
            </>
          ) : null}
        </p>
      </SheetContent>
    </Sheet>
  )
}
