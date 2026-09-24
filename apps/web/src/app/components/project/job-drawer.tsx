// "ジョブを選ぶ": the picker of project-jobs-compare-drawer.html (`.job-drawer`),
// the Sheet on the left over the dimmed page. The Sheet brings the overlay,
// the focus trap, Escape and the panel's placement; this component fills it.
import type { Job } from '@/shared/types'
import type { StatusFilter } from '../../lib/job-filter'
import type { ProjectLinkState } from '../../lib/project-link'
import { Button } from '../ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet'
import { type JobSelection, JobTable } from './job-table'
import { JobsToolbar } from './jobs-toolbar'

export interface JobDrawerProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectName: string
  linkState: ProjectLinkState | null
  /** Rows after the drawer's own filter and search. */
  jobs: Job[]
  loading: boolean
  error: string | null
  now: string
  selection: JobSelection
  onClearSelection: () => void
  filter: StatusFilter
  onFilterChange: (value: string) => void
  query: string
  onQueryChange: (value: string) => void
}

export function JobDrawer({
  open,
  onClose,
  projectId,
  projectName,
  linkState,
  jobs,
  loading,
  error,
  now,
  selection,
  onClearSelection,
  filter,
  onFilterChange,
  query,
  onQueryChange,
}: JobDrawerProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      {/* The footer has the plain "閉じる" button; the corner one gets a fuller name. */}
      <SheetContent side="left" closeLabel="ジョブ選択を閉じる">
        <SheetHeader>
          <SheetTitle>ジョブを選ぶ</SheetTitle>
        </SheetHeader>
        <SheetDescription>チェックすると、比較チャートにすぐ反映されます。</SheetDescription>
        <JobsToolbar
          size="compact"
          query={query}
          onQueryChange={onQueryChange}
          filter={filter}
          onFilterChange={onFilterChange}
        />
        {error === null ? null : (
          <p role="alert" className="pb-3 text-xs text-destructive">
            {error}
          </p>
        )}
        {jobs.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {loading ? 'ジョブを読み込んでいます…' : '一致するジョブはありません。'}
          </p>
        ) : (
          <JobTable
            projectId={projectId}
            projectName={projectName}
            jobs={jobs}
            now={now}
            linkState={linkState}
            selection={selection}
          />
        )}
        <SheetFooter>
          <Button variant="ghost" type="button" onClick={onClearSelection}>
            選択を解除
          </Button>
          <SheetClose asChild>
            <Button type="button">閉じる</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
