import { Link, useLocation } from '@tanstack/react-router'
import { JobActions } from '../components/job/job-actions'
import { JobHeader } from '../components/job/job-header'
import { JobSections } from '../components/job/job-sections'
import { JobSettingsSheet } from '../components/job/job-settings-sheet'
import { JobFailure, JobSummary } from '../components/job/job-summary'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { useActionFlags } from '../hooks/use-action-flags'
import { useJobDetail } from '../hooks/use-job-detail'
import { useRequiredParam } from '../hooks/use-required-param'
import { readProjectLinkState } from '../lib/project-link'

/** Same width cap as the other pages (docs/mock-diff/designs/pages/job-detail.html). */
const PAGE_CLASS = 'mx-auto max-w-[1600px] px-8 py-6'

export default function JobDetailPage() {
  const projectId = useRequiredParam('projectId')
  const jobId = useRequiredParam('jobId')
  const location = useLocation()
  const detail = useJobDetail(projectId, jobId, readProjectLinkState(location.state, projectId))
  const { job } = detail
  const flags = useActionFlags<'settings'>()

  if (job.job === null) {
    if (job.error !== null) {
      return (
        <div className={PAGE_CLASS}>
          <h1>job を表示できません</h1>
          <p role="alert" className="mt-2 text-muted-foreground">
            {job.error}
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={job.refresh}>
              もう一度試す
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/projects/$projectId" params={{ projectId }}>
                job 一覧へ戻る
              </Link>
            </Button>
          </div>
        </div>
      )
    }
    return (
      <div role="status" className={`${PAGE_CLASS} grid gap-4`}>
        <span className="sr-only">読み込み中</span>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-[280px]" />
        <Skeleton className="h-4 w-[360px] max-w-full" />
      </div>
    )
  }

  return (
    <div className={PAGE_CLASS}>
      <JobHeader
        projectId={projectId}
        project={detail.project}
        job={job.job}
        creator={detail.creator}
        connection={detail.connection}
        now={detail.now}
        lastReceivedAt={detail.lastReceivedAt}
        actions={
          <>
            <JobSettingsSheet
              open={flags.isOpen('settings')}
              onOpenChange={(open) => flags.setOpen('settings', open)}
              job={job.job}
              creator={detail.creator}
            />
            <JobActions
              projectId={projectId}
              project={detail.project}
              owner={detail.creator}
              job={job.job}
              refresh={job.refresh}
            />
          </>
        }
      />
      {job.job.status === 'failed' ? <JobFailure lines={detail.logs.lines} /> : null}
      <JobSummary series={detail.metrics.series} config={job.job.config} />
      <div className="pt-5">
        <JobSections detail={detail} job={job.job} />
      </div>
    </div>
  )
}
