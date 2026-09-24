import { Link, useLocation } from '@tanstack/react-router'
import { JobHeader } from '../components/job/job-header'
import { JobSections } from '../components/job/job-sections'
import { JobSidebar } from '../components/job/job-sidebar'
import { JobFailure, JobSummary } from '../components/job/job-summary'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { useJobDetail } from '../hooks/use-job-detail'
import { useRequiredParam } from '../hooks/use-required-param'
import { readProjectLinkState } from '../lib/project-link'

/** Page width and padding shared with the other pages (docs/mock-diff/designs/pages). */
const PAGE_CLASS = 'mx-auto max-w-[1312px] px-8 py-6'

export default function JobDetailPage() {
  const projectId = useRequiredParam('projectId')
  const jobId = useRequiredParam('jobId')
  const location = useLocation()
  const detail = useJobDetail(projectId, jobId, readProjectLinkState(location.state, projectId))
  const { job } = detail

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
      />
      {job.job.status === 'failed' ? <JobFailure lines={detail.logs.lines} /> : null}
      <JobSummary series={detail.metrics.series} config={job.job.config} />
      <div className="grid gap-8 pt-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <JobSections detail={detail} job={job.job} />
        </div>
        <JobSidebar job={job.job} creator={detail.creator} />
      </div>
    </div>
  )
}
