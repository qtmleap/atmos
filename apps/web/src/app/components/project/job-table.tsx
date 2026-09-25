// The job list of project-jobs.html (`.jobs-table`): name over id, state,
// start time, run time and the last step. With `selection` it becomes the
// drawer's picker (project-jobs-compare-drawer.html): a checkbox column in
// front, state as a mark only, no step column, 13px text.
import { Link } from '@tanstack/react-router'
import type { Job } from '@/shared/types'
import {
  formatDuration,
  formatShortDateTimeUtc,
  jobDisplayName,
  STATUS_LABELS,
} from '../../lib/format'
import type { ProjectLinkState } from '../../lib/project-link'
import { cn } from '../../lib/utils'
import { Status } from '../ui/status'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

export interface JobSelection {
  selected: ReadonlySet<string>
  /** No more boxes can be ticked (the colour list is used up). */
  full: boolean
  onToggle: (jobId: string) => void
}

export interface JobTableProps {
  projectId: string
  projectName: string
  jobs: Job[]
  now: string
  linkState: ProjectLinkState | null
  selection?: JobSelection
}

/** Header cells are 12px muted (the mock's `.list-table th`). */
const HEAD = 'text-xs text-muted-foreground'
/** Body rows are 58px tall (the mock's `.jobs-table td`). */
const CELL = 'h-[58px]'

const formatStep = (step: number | undefined): string =>
  step === undefined ? '—' : step.toLocaleString('en-US')

export function JobTable({
  projectId,
  projectName,
  jobs,
  now,
  linkState,
  selection,
}: JobTableProps) {
  const picking = selection !== undefined
  return (
    <Table
      aria-label={`${projectName} のジョブ一覧`}
      className={cn('whitespace-nowrap', picking && 'text-[13px]')}
    >
      <TableHeader>
        <TableRow>
          {picking ? (
            <TableHead scope="col" className={cn(HEAD, 'w-10')}>
              <span className="sr-only">比較</span>
            </TableHead>
          ) : null}
          <TableHead scope="col" className={HEAD}>
            ジョブ名
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            状態
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            開始時刻 ↓
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            実行時間
          </TableHead>
          {picking ? null : (
            <TableHead scope="col" data-numeric="true" className={HEAD}>
              ステップ
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => {
          const name = jobDisplayName(job)
          return (
            <TableRow key={job.id}>
              {selection === undefined ? null : (
                <TableCell className={cn(CELL, 'w-10')}>
                  <input
                    type="checkbox"
                    className="mx-1 size-4 accent-primary align-middle"
                    aria-label={`${name} を比較に含める`}
                    checked={selection.selected.has(job.id)}
                    disabled={!selection.selected.has(job.id) && selection.full}
                    onChange={() => selection.onToggle(job.id)}
                  />
                </TableCell>
              )}
              <TableCell className={CELL}>
                <Link
                  to="/projects/$projectId/jobs/$jobId"
                  params={{ projectId, jobId: job.id }}
                  state={linkState === null ? undefined : linkState}
                  className="font-medium hover:underline hover:underline-offset-4"
                >
                  {name}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">{job.id}</p>
              </TableCell>
              <TableCell className={CELL}>
                {picking ? (
                  <Status
                    status={job.status}
                    aria-label={STATUS_LABELS[job.status]}
                    className="size-4 justify-center"
                  />
                ) : (
                  <Status status={job.status}>{STATUS_LABELS[job.status]}</Status>
                )}
              </TableCell>
              <TableCell className={cn(CELL, 'font-mono text-xs')}>
                <time dateTime={job.started_at}>{formatShortDateTimeUtc(job.started_at)}</time>
              </TableCell>
              <TableCell className={cn(CELL, 'font-mono text-xs')}>
                {formatDuration(job.started_at, job.finished_at, now)}
              </TableCell>
              {picking ? null : (
                <TableCell
                  data-numeric="true"
                  className={cn(CELL, 'font-mono text-xs text-muted-foreground')}
                >
                  {formatStep(job.last_step)}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
