// The comparison view: every job of the project (the default pick and the
// "n / m件" count need the whole list, not a page), which of them are drawn,
// and the drawer's own filter and search. Selection and drawer state live in
// the URL (lib/job-filter.ts); the drawer's filter and search are local.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Job, PAGINATION_MAX_LIMIT, type Page } from '@/shared/types'
import { apiFetch, errorMessage, withQuery } from '../lib/api-client'
import {
  COMPARE_MAX_JOBS,
  filterJobs,
  isStatusFilter,
  type JobsSearch,
  jobsListPath,
  parseCompareSelection,
  parseDrawerOpen,
  type StatusFilter,
  serializeCompareSelection,
} from '../lib/job-filter'

/** Pages fetched at most; beyond this the comparison works on what arrived. */
const MAX_PAGES = 5

export interface AllJobs {
  jobs: Job[]
  loading: boolean
  error: string | null
}

const loadAll = async (
  path: string,
  cursor: string | undefined,
  pagesLeft: number,
  onPage: (items: Job[]) => void,
): Promise<void> => {
  const page = await apiFetch<Page<Job>>(withQuery(path, { limit: PAGINATION_MAX_LIMIT, cursor }))
  onPage(page.items)
  if (page.next_cursor !== null && pagesLeft > 1) {
    await loadAll(path, page.next_cursor, pagesLeft - 1, onPage)
  }
}

/** Every job of the project, newest first, fetched page after page. */
export function useAllJobs(projectId: string): AllJobs {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = { cancelled: false }
    setJobs([])
    setLoading(true)
    setError(null)
    loadAll(jobsListPath(projectId, 'all'), undefined, MAX_PAGES, (items) => {
      if (!controller.cancelled) {
        setJobs((current) => [...current, ...items])
      }
    })
      .catch((caught: unknown) => {
        if (!controller.cancelled) {
          setError(errorMessage(caught))
        }
      })
      .finally(() => {
        if (!controller.cancelled) {
          setLoading(false)
        }
      })
    return () => {
      controller.cancelled = true
    }
  }, [projectId])

  return { jobs, loading, error }
}

export interface CompareJobs extends AllJobs {
  /** Ids drawn, newest first. */
  selected: string[]
  selectedSet: ReadonlySet<string>
  /** True once COMPARE_MAX_JOBS are picked; further boxes are disabled. */
  full: boolean
  toggle: (jobId: string) => void
  clearSelection: () => void
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  /** The drawer's filter and search, over `jobs`. */
  filter: StatusFilter
  setFilter: (value: string) => void
  query: string
  setQuery: (value: string) => void
  visible: Job[]
}

export function useCompareJobs(projectId: string): CompareJobs {
  const all = useAllJobs(projectId)
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const [filter, setFilterState] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => parseCompareSelection(search.jobs, all.jobs),
    [search.jobs, all.jobs],
  )
  const selectedSet = useMemo(() => new Set(selected), [selected])

  // Merges `change` into the search params in place, keeping the history
  // state (the project name) across the change.
  const update = useCallback(
    (change: Partial<JobsSearch>) => {
      void navigate({
        to: '.',
        search: (current) => ({ ...current, ...change }),
        replace: true,
        state: true,
      })
    },
    [navigate],
  )

  const toggle = useCallback(
    (jobId: string) => {
      const next = selectedSet.has(jobId)
        ? selected.filter((id) => id !== jobId)
        : all.jobs.filter((job) => job.id === jobId || selectedSet.has(job.id)).map((j) => j.id)
      if (next.length > COMPARE_MAX_JOBS) {
        return
      }
      update({ jobs: serializeCompareSelection(next) })
    },
    [selected, selectedSet, all.jobs, update],
  )

  const clearSelection = useCallback(() => {
    update({ jobs: '' })
  }, [update])

  const openDrawer = useCallback(() => {
    update({ drawer: 'jobs' })
  }, [update])
  const closeDrawer = useCallback(() => {
    update({ drawer: undefined })
  }, [update])
  const setFilter = useCallback((value: string) => {
    if (isStatusFilter(value)) {
      setFilterState(value)
    }
  }, [])

  const visible = useMemo(() => filterJobs(all.jobs, filter, query), [all.jobs, filter, query])

  return {
    ...all,
    selected,
    selectedSet,
    full: selected.length >= COMPARE_MAX_JOBS,
    toggle,
    clearSelection,
    drawerOpen: parseDrawerOpen(search.drawer),
    openDrawer,
    closeDrawer,
    filter,
    setFilter,
    query,
    setQuery,
    visible,
  }
}
