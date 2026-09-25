import { useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import type { Job, Project } from '@/shared/types'
import { filterJobs, isStatusFilter, jobsListPath, type StatusFilter } from '../lib/job-filter'
import { readProjectLinkState } from '../lib/project-link'
import { useNow } from './use-now'
import { type PagedList, usePagedList } from './use-paged-list'
import { useProject } from './use-project'

export const JOBS_PAGE_SIZE = 50

/** What the heading needs of the project. */
export type ProjectHeading = Pick<Project, 'id' | 'name' | 'visibility'> &
  Partial<Pick<Project, 'owner' | 'job_count'>>

export interface ProjectJobs {
  filter: StatusFilter
  setFilter: (value: string) => void
  /** Search box over the rows loaded so far. */
  query: string
  setQuery: (value: string) => void
  jobs: PagedList<Job>
  /** `jobs.items` narrowed by the search box. */
  visible: Job[]
  /** Ticks while a listed job is running, for its elapsed time. */
  now: string
}

/** The project heading: fetched project when known, else the router state, else null. */
export function useProjectHeading(projectId: string): {
  project: ProjectHeading | null
  error: string | null
  /** HTTP status of a failed project load (401, 403, 404 become full-page errors). */
  status: number | null
} {
  const location = useLocation()
  const fetched = useProject(projectId)
  const linked = readProjectLinkState(location.state, projectId)
  return {
    project: fetched.project === null ? linked : fetched.project,
    error: fetched.error,
    status: fetched.status,
  }
}

export function useProjectJobs(projectId: string): ProjectJobs {
  const navigate = useNavigate()
  const { status } = useSearch({ strict: false })
  const filter: StatusFilter = status === undefined ? 'all' : status
  const jobs = usePagedList<Job>(jobsListPath(projectId, filter), JOBS_PAGE_SIZE)
  const [query, setQuery] = useState('')
  const now = useNow(
    1000,
    jobs.items.some((job) => job.status === 'running'),
  )

  const setFilter = useCallback(
    (value: string) => {
      if (!isStatusFilter(value)) {
        return
      }
      void navigate({
        to: '.',
        search: (current) => ({ ...current, status: value === 'all' ? undefined : value }),
        replace: true,
        // Keep the history state so the project name survives the filter change.
        state: true,
      })
    },
    [navigate],
  )

  const visible = useMemo(() => filterJobs(jobs.items, 'all', query), [jobs.items, query])

  return {
    filter,
    setFilter,
    query,
    setQuery,
    jobs,
    visible,
    now,
  }
}
