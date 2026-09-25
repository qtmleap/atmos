import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import type { Job, ProjectOwner } from '@/shared/types'
import type { LiveConnection } from '../../hooks/use-job-live'
import type { LinkedProject } from '../../hooks/use-job-project'
import { describeJob } from '../../lib/config'
import { formatDuration, jobDisplayName, STATUS_LABELS } from '../../lib/format'
import { Status } from '../ui/status'
import { formatUtcClock, formatUtcDateTime } from './format-utc'
import { ConnectionIndicator } from './live-indicator'

export interface JobHeaderProps {
  projectId: string
  project: LinkedProject | null
  job: Job
  /** Who started the job; null while unknown, which drops the name from the start line. */
  creator: ProjectOwner | null
  connection: LiveConnection
  now: string
  /** When the newest metric or log line was received. */
  lastReceivedAt: string | null
  /** The "…" menu after the update state, for those who can manage the project. */
  actions?: React.ReactNode
}

/** Right side of the title row: the live state, or when updates stopped. */
function UpdateState({
  job,
  connection,
  lastReceivedAt,
}: Pick<JobHeaderProps, 'job' | 'connection' | 'lastReceivedAt'>) {
  if (job.status === 'running') {
    return (
      <div className="flex items-center gap-3">
        <ConnectionIndicator connection={connection} />
        {lastReceivedAt === null ? null : (
          <span className="text-xs text-muted-foreground">
            最終受信 {formatUtcClock(lastReceivedAt)}
          </span>
        )}
      </div>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      更新終了{job.finished_at === null ? '' : ` · ${formatUtcClock(job.finished_at)}`}
    </span>
  )
}

/** Breadcrumb, title with status, update state, and the start line. Ruled below. */
export function JobHeader({
  projectId,
  project,
  job,
  creator,
  connection,
  now,
  lastReceivedAt,
  actions,
}: JobHeaderProps) {
  const running = job.status === 'running'
  const description = describeJob(job.config)
  // A running job's elapsed time is measured to its last report, which is
  // how far the training has got; the clock only stands in before one arrives.
  const elapsedUntil = lastReceivedAt === null ? now : lastReceivedAt
  return (
    <>
      <nav aria-label="パンくず">
        <ol className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <li className="inline-flex items-center gap-2">
            <Link to="/" className="hover:underline hover:underline-offset-4">
              プロジェクト
            </Link>
            <span aria-hidden="true">/</span>
          </li>
          <li className="inline-flex items-center gap-2">
            <Link
              to="/projects/$projectId"
              params={{ projectId }}
              state={project === null ? undefined : { project }}
              className="hover:underline hover:underline-offset-4"
            >
              {project === null ? projectId : project.name}
            </Link>
            <span aria-hidden="true">/</span>
          </li>
          <li aria-current="page" className="text-foreground">
            {jobDisplayName(job)}
          </li>
        </ol>
      </nav>
      <header className="grid gap-3 border-b py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* The mocks' `.page-header h1` is 24/32, smaller than the 30/36 base h1. */}
            <h1 className="text-2xl leading-8">{jobDisplayName(job)}</h1>
            <Status status={job.status}>{STATUS_LABELS[job.status]}</Status>
          </div>
          <div className="flex items-center gap-3">
            <UpdateState job={job} connection={connection} lastReceivedAt={lastReceivedAt} />
            {actions}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {creator === null ? '開始' : `${creator.display_name} が開始`} ·{' '}
            <time dateTime={job.started_at}>{formatUtcDateTime(job.started_at)}</time> ·{' '}
            {running ? '経過' : '所要時間'}{' '}
            {formatDuration(job.started_at, job.finished_at, elapsedUntil)}
          </p>
          {description === null ? null : (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      </header>
    </>
  )
}
