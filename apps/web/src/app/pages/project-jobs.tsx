// /projects/:projectId — the job list of a project (designs/pages/project-jobs.html)
// and, with `?view=compare`, the metrics comparison of chosen jobs
// (project-jobs-compare.html; `&drawer=jobs` opens the picker,
// project-jobs-compare-drawer.html). Every state is in the URL (lib/job-filter.ts).
import { useSearch } from '@tanstack/react-router'
import { AccessErrorPage } from '../components/common/error-page'
import { ListFooter } from '../components/common/list-footer'
import { LoadingRows } from '../components/common/loading-rows'
import { CompareLayout } from '../components/project/compare-layout'
import { JobDrawer } from '../components/project/job-drawer'
import { JobTable } from '../components/project/job-table'
import { JobsEmptyState } from '../components/project/jobs-empty-state'
import { JobsFootnote } from '../components/project/jobs-footnote'
import { JobsToolbar } from '../components/project/jobs-toolbar'
import { ProjectActions } from '../components/project/project-actions'
import { ProjectHeader } from '../components/project/project-header'
import { useCompareJobs } from '../hooks/use-compare-jobs'
import { useCompareMetrics } from '../hooks/use-compare-metrics'
import { useNow } from '../hooks/use-now'
import { type ProjectHeading, useProjectHeading, useProjectJobs } from '../hooks/use-project-jobs'
import { useRequiredParam } from '../hooks/use-required-param'
import { accessErrorKind } from '../lib/access-error'
import { parseJobsView } from '../lib/job-filter'
import { projectLinkState } from '../lib/project-link'

/** Page width and padding shared with the other pages (docs/mock-diff/designs/pages). */
const PAGE_CLASS = 'mx-auto max-w-[1600px] px-8 pt-4 pb-6'
/** The comparison uses the whole window for its charts (project-jobs-compare.html). */
const COMPARE_PAGE_CLASS = 'px-8 pt-4 pb-6'

const SORT_NOTE = '開始時刻が新しい順 · 日時は UTC'

interface ViewProps {
  projectId: string
  project: ProjectHeading | null
}

const headingName = ({ projectId, project }: ViewProps): string =>
  project === null ? projectId : project.name

function JobsListView({ projectId, project }: ViewProps) {
  const { filter, setFilter, query, setQuery, jobs, visible, now } = useProjectJobs(projectId)
  const linkState = project === null ? null : projectLinkState(project)
  const empty = !jobs.initial && jobs.items.length === 0 && jobs.error === null
  if (empty && filter === 'all') {
    return <JobsEmptyState projectName={headingName({ projectId, project })} />
  }
  return (
    <>
      <JobsToolbar
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        note={SORT_NOTE}
      />
      {jobs.initial ? <LoadingRows /> : null}
      {empty ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          該当する状態のジョブはありません。
        </p>
      ) : null}
      {!jobs.initial && jobs.items.length > 0 && visible.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          一致するジョブはありません。
        </p>
      ) : null}
      {visible.length > 0 ? (
        <JobTable
          projectId={projectId}
          projectName={headingName({ projectId, project })}
          jobs={visible}
          now={now}
          linkState={linkState}
        />
      ) : null}
      {jobs.initial ? null : (
        <ListFooter
          noun="ジョブ"
          count={jobs.items.length}
          hasMore={jobs.hasMore}
          loading={jobs.loading}
          error={jobs.error}
          onLoadMore={jobs.loadMore}
          onRetry={jobs.retry}
        />
      )}
      <JobsFootnote now={now} />
    </>
  )
}

function CompareView({ projectId, project }: ViewProps) {
  const { jobs: selectedJobs } = useSearch({ strict: false })
  const compare = useCompareJobs(projectId)
  const metrics = useCompareMetrics(projectId, compare.selected)
  const now = useNow(
    1000,
    compare.drawerOpen && compare.jobs.some((job) => job.status === 'running'),
  )
  const linkState = project === null ? null : projectLinkState(project)
  return (
    <>
      {compare.error === null ? null : (
        <p role="alert" className="pt-4 text-xs text-destructive">
          {compare.error}
        </p>
      )}
      <CompareLayout
        jobs={compare.jobs}
        selected={compare.selected}
        defaultSelection={selectedJobs === undefined}
        metrics={metrics}
        onOpenDrawer={compare.openDrawer}
      />
      <JobsFootnote now={now} />
      <JobDrawer
        open={compare.drawerOpen}
        onClose={compare.closeDrawer}
        projectId={projectId}
        projectName={headingName({ projectId, project })}
        linkState={linkState}
        jobs={compare.visible}
        loading={compare.loading}
        error={compare.error}
        now={now}
        selection={{
          selected: compare.selectedSet,
          full: compare.full,
          onToggle: compare.toggle,
        }}
        onClearSelection={compare.clearSelection}
        filter={compare.filter}
        onFilterChange={compare.setFilter}
        query={compare.query}
        onQueryChange={compare.setQuery}
      />
    </>
  )
}

export default function ProjectJobsPage() {
  const projectId = useRequiredParam('projectId')
  const search = useSearch({ strict: false })
  const view = parseJobsView(search.view)
  const heading = useProjectHeading(projectId)
  const denied = accessErrorKind(heading.status)
  if (denied !== null) {
    return (
      <div className={PAGE_CLASS}>
        <AccessErrorPage kind={denied} subject="project" projectId={projectId} />
      </div>
    )
  }
  return (
    <div className={view === 'compare' ? COMPARE_PAGE_CLASS : PAGE_CLASS}>
      <ProjectHeader
        projectId={projectId}
        project={heading.project}
        description={
          view === 'compare'
            ? 'ジョブ一覧 ／ 選んだジョブのメトリクスを重ねて比べられます。'
            : 'ジョブ一覧 ／ 学習の進行状況を確認できます。'
        }
        actions={heading.project === null ? null : <ProjectActions project={heading.project} />}
      />
      {heading.error === null ? null : (
        <p role="alert" className="pt-4 text-xs text-destructive">
          {heading.error}
        </p>
      )}
      {view === 'compare' ? (
        <CompareView projectId={projectId} project={heading.project} />
      ) : (
        <JobsListView projectId={projectId} project={heading.project} />
      )}
    </div>
  )
}
