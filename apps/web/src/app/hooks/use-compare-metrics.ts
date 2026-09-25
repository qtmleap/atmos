// Metric series of the jobs drawn in the comparison. Each job's metrics are
// fetched (`GET .../jobs/:job_id/metrics`, every page) and kept in a module
// cache, so ticking a job in the drawer redraws at once when it has been seen
// before. A running job is still logging, so its entry never counts as
// settled: it is fetched again on every change of the selection (the last
// data shows meanwhile) and once more after it stops.
import { useEffect, useMemo, useState } from 'react'
import { type JobStatus, type Metric, PAGINATION_MAX_LIMIT, type Page } from '@/shared/types'
import { apiFetch, errorMessage, withQuery } from '../lib/api-client'
import { jobApiPath } from '../lib/job-paths'
import { groupMetricsBySeries, type MetricSeries } from '../lib/metrics'

export interface JobSeries {
  jobId: string
  series: MetricSeries[]
  /** Keys in the order the job first logged them (the API lists rows by id). */
  keyOrder: string[]
}

export interface CompareMetrics {
  /** One entry per selected job whose metrics have arrived, in selection order. */
  loaded: JobSeries[]
  /** Metric keys across the loaded jobs: the first job's logging order, then what the others add. */
  keys: string[]
  /** Highest step across the loaded jobs (0 when nothing is loaded). */
  maxStep: number
  loading: boolean
  error: string | null
}

/** What the hook needs to know of a job to decide whether its metrics can be kept. */
export type JobStatusRow = { id: string; status: JobStatus }

interface CachedJob extends Omit<JobSeries, 'jobId'> {
  /** Fetched while the job was no longer running, so nothing more will be logged. */
  settled: boolean
}

const cache = new Map<string, CachedJob>()
const inFlight = new Map<string, Promise<CachedJob>>()

const fetchAll = async (path: string, cursor: string | undefined): Promise<Metric[]> => {
  const page = await apiFetch<Page<Metric>>(
    withQuery(path, { limit: PAGINATION_MAX_LIMIT, cursor }),
  )
  if (page.next_cursor === null) {
    return page.items
  }
  const rest = await fetchAll(path, page.next_cursor)
  return [...page.items, ...rest]
}

const firstAppearance = (metrics: readonly Metric[]): string[] => [
  ...new Set(metrics.map((metric) => metric.key)),
]

/** True when the cache holds the job and needs no refresh. */
const isFresh = (jobId: string, running: ReadonlySet<string>): boolean => {
  if (running.has(jobId)) {
    return false
  }
  const known = cache.get(jobId)
  return known === undefined ? false : known.settled
}

const loadJob = (projectId: string, jobId: string, settled: boolean): Promise<CachedJob> => {
  const pending = inFlight.get(jobId)
  if (pending !== undefined) {
    return pending
  }
  const request = fetchAll(jobApiPath(projectId, jobId, '/metrics'), undefined)
    .then((metrics) => {
      const job = {
        series: groupMetricsBySeries(metrics),
        keyOrder: firstAppearance(metrics),
        settled,
      }
      cache.set(jobId, job)
      return job
    })
    .finally(() => {
      inFlight.delete(jobId)
    })
  inFlight.set(jobId, request)
  return request
}

/** Series of every job in `ids` that the cache holds, in that order. */
const collect = (ids: readonly string[]): JobSeries[] =>
  ids.flatMap((jobId) => {
    const job = cache.get(jobId)
    return job === undefined ? [] : [{ jobId, series: job.series, keyOrder: job.keyOrder }]
  })

/**
 * @param jobIds the jobs drawn, in selection order
 * @param jobs the project's jobs with their status; a selected job that is
 *   running is fetched again on every change. Without the list every job is
 *   taken as settled and fetched once.
 */
export function useCompareMetrics(
  projectId: string,
  jobIds: readonly string[],
  jobs: readonly JobStatusRow[] = [],
): CompareMetrics {
  const [loaded, setLoaded] = useState<JobSeries[]>(() => collect(jobIds))
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const idsKey = jobIds.join(',')
  // The selected jobs that are still logging, so their cache entry never counts.
  const runningKey = useMemo(() => {
    const running = new Set(jobs.filter((job) => job.status === 'running').map((job) => job.id))
    return jobIds.filter((id) => running.has(id)).join(',')
  }, [jobs, jobIds])

  useEffect(() => {
    const ids = idsKey === '' ? [] : idsKey.split(',')
    const running = new Set(runningKey === '' ? [] : runningKey.split(','))
    const controller = { cancelled: false }
    setLoaded(collect(ids))
    const stale = ids.filter((id) => !isFresh(id, running))
    setPendingCount(stale.length)
    setError(null)
    for (const id of stale) {
      loadJob(projectId, id, !running.has(id))
        .then(() => {
          if (!controller.cancelled) {
            setLoaded(collect(ids))
          }
        })
        .catch((caught: unknown) => {
          if (!controller.cancelled) {
            setError(errorMessage(caught))
          }
        })
        .finally(() => {
          if (!controller.cancelled) {
            setPendingCount((n) => n - 1)
          }
        })
    }
    return () => {
      controller.cancelled = true
    }
  }, [projectId, idsKey, runningKey])

  return useMemo(() => {
    const keys = [...new Set(loaded.flatMap((entry) => entry.keyOrder))]
    const maxStep = loaded.reduce(
      (max, entry) => entry.series.reduce((m, s) => Math.max(m, s.latest.step), max),
      0,
    )
    return { loaded, keys, maxStep, loading: pendingCount > 0, error }
  }, [loaded, pendingCount, error])
}
