// The state of the job list lives in the URL so a view can be shared as a link:
//   ?status=running          status filter of the list (server side)
//   ?view=compare            the metrics comparison instead of the table
//   ?drawer=jobs             the "ジョブを選ぶ" drawer is open (compare view)
//   ?jobs=id1,id2            jobs drawn in the comparison; absent means the
//                            default pick (defaultCompareSelection), empty none
import { z } from 'zod'
import { JOB_STATUSES, type Job, type JobStatus } from '@/shared/types'
import { withQuery } from './api-client'
import { jobDisplayName } from './format'

/**
 * The search params of /projects/:projectId (routes/_app/projects.$projectId.tsx).
 * A value the schema does not know is dropped, not an error: an unknown
 * status is "all", an unknown view is the list.
 */
export const jobsSearchSchema = z.object({
  status: z.enum(JOB_STATUSES).optional().catch(undefined),
  view: z.literal('compare').optional().catch(undefined),
  drawer: z.literal('jobs').optional().catch(undefined),
  // Comma-separated ids; `jobs=` (empty) is an explicit empty selection,
  // distinct from the default pick when the param is absent.
  jobs: z
    .union([z.literal(''), z.string().nonempty()])
    .optional()
    .catch(undefined),
})

export type JobsSearch = z.infer<typeof jobsSearchSchema>

export type StatusFilter = JobStatus | 'all'

export const STATUS_FILTERS: readonly StatusFilter[] = ['all', ...JOB_STATUSES]

const isJobStatus = (value: string | undefined): value is JobStatus =>
  JOB_STATUSES.some((status) => status === value)

/** Unknown or missing values mean "all". */
export const parseStatusFilter = (value: string | undefined): StatusFilter =>
  isJobStatus(value) ? value : 'all'

export const isStatusFilter = (value: string): value is StatusFilter =>
  value === 'all' || isJobStatus(value)

/** `GET /api/projects/:project_id/jobs` path for a filter (pagination is added by the list). */
export const jobsListPath = (projectId: string, filter: StatusFilter): string =>
  withQuery(`/api/projects/${encodeURIComponent(projectId)}/jobs`, {
    status: filter === 'all' ? undefined : filter,
  })

export type JobsView = 'list' | 'compare'

export const parseJobsView = (value: string | undefined): JobsView =>
  value === 'compare' ? 'compare' : 'list'

export const parseDrawerOpen = (value: string | undefined): boolean => value === 'jobs'

// The name as shown, so an unnamed job answers to "名前なし" and its id head.
const matchesQuery = (job: Job, needle: string): boolean =>
  needle === '' ||
  job.id.toLocaleLowerCase().includes(needle) ||
  jobDisplayName(job).toLocaleLowerCase().includes(needle)

/** Jobs of the status whose displayed name or id contains the query (case-insensitive). */
export const filterJobs = (jobs: readonly Job[], filter: StatusFilter, query: string): Job[] => {
  const needle = query.trim().toLocaleLowerCase()
  return jobs.filter(
    (job) => (filter === 'all' || job.status === filter) && matchesQuery(job, needle),
  )
}

/** At most this many jobs are drawn at once (one colour each). */
export const COMPARE_MAX_JOBS = 10

/** The default comparison: the newest jobs that did not fail, up to the colour count. */
export const defaultCompareSelection = (jobs: readonly Job[]): string[] =>
  jobs
    .filter((job) => job.status !== 'failed')
    .slice(0, COMPARE_MAX_JOBS)
    .map((job) => job.id)

/**
 * The `jobs` query value as ids, in the order of `jobs` (newest first).
 * undefined (parameter absent) means the default selection; ids not in the
 * list are dropped.
 */
export const parseCompareSelection = (
  value: string | undefined,
  jobs: readonly Job[],
): string[] => {
  if (value === undefined) {
    return defaultCompareSelection(jobs)
  }
  const wanted = new Set(value.split(',').filter((id) => id !== ''))
  return jobs.filter((job) => wanted.has(job.id)).map((job) => job.id)
}

export const serializeCompareSelection = (ids: readonly string[]): string => ids.join(',')
