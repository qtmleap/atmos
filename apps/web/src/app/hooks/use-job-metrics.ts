import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Metric, PAGINATION_MAX_LIMIT, type Page } from '@/shared/types'
import { apiFetch, errorMessage, withQuery } from '../lib/api-client'
import { jobApiPath } from '../lib/job-paths'
import {
  groupMetricsBySeries,
  lastLoggedAt,
  type MetricSeries,
  reuseUnchangedSeries,
} from '../lib/metrics'
import { mergeBySerialId } from '../lib/serial-id'
import { useBatched } from './use-batched'

export interface JobMetrics {
  series: MetricSeries[]
  /** Metric rows held. */
  count: number
  /** When the newest row held was logged; null before anything arrived. */
  lastLoggedAt: string | null
  loading: boolean
  error: string | null
  pushLive: (metric: Metric) => void
  /** Fetches whatever was logged after the last row held (after a reconnect). */
  catchUp: () => void
  retry: () => void
}

/**
 * Every metric of a job (`GET .../metrics`), fetched page after page until
 * the end: the charts need the whole history. Live rows are merged by id.
 */
export function useJobMetrics(projectId: string, jobId: string): JobMetrics {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const loadingRef = useRef(false)
  const lastId = useRef<string | undefined>(undefined)
  const basePath = jobApiPath(projectId, jobId, '/metrics')

  const merge = useCallback((incoming: Metric[]) => {
    setMetrics((current) => {
      const merged = mergeBySerialId(current, incoming)
      lastId.current = merged.at(-1)?.id
      return merged
    })
  }, [])

  const loadFrom = useCallback(
    async (cursor: string | undefined, gen: number): Promise<void> => {
      const page = await apiFetch<Page<Metric>>(
        withQuery(basePath, { limit: PAGINATION_MAX_LIMIT, cursor }),
      )
      if (gen !== generation.current) {
        return
      }
      merge(page.items)
      if (page.next_cursor !== null) {
        await loadFrom(page.next_cursor, gen)
      }
    },
    [basePath, merge],
  )

  const run = useCallback(
    async (cursor: string | undefined) => {
      if (loadingRef.current) {
        return
      }
      const gen = generation.current
      loadingRef.current = true
      setLoading(true)
      setError(null)
      try {
        await loadFrom(cursor, gen)
      } catch (caught) {
        if (gen === generation.current) {
          setError(errorMessage(caught))
        }
      } finally {
        if (gen === generation.current) {
          loadingRef.current = false
          setLoading(false)
        }
      }
    },
    [loadFrom],
  )

  useEffect(() => {
    generation.current += 1
    loadingRef.current = false
    lastId.current = undefined
    setMetrics([])
    void run(undefined)
    return () => {
      generation.current += 1
    }
  }, [run])

  const pushLive = useBatched(merge, 500)
  const catchUp = useCallback(() => {
    void run(lastId.current)
  }, [run])

  const previousSeries = useRef<MetricSeries[]>([])
  const series = useMemo(() => {
    const next = reuseUnchangedSeries(previousSeries.current, groupMetricsBySeries(metrics))
    previousSeries.current = next
    return next
  }, [metrics])
  const latestAt = useMemo(() => lastLoggedAt(metrics), [metrics])
  return {
    series,
    count: metrics.length,
    lastLoggedAt: latestAt,
    loading,
    error,
    pushLive,
    catchUp,
    retry: catchUp,
  }
}
