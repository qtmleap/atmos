import { useCallback, useEffect, useRef, useState } from 'react'
import type { Job, LiveStatusData } from '@/shared/types'
import { apiFetch, errorMessage } from '../lib/api-client'
import { jobApiPath } from '../lib/job-paths'

export interface JobResource {
  job: Job | null
  loading: boolean
  error: string | null
  /** Refetches the job (the list of fields a live status message carries is partial). */
  refresh: () => void
  applyStatus: (data: LiveStatusData) => void
}

/** `GET /api/projects/:project_id/jobs/:job_id` */
export function useJob(projectId: string, jobId: string): JobResource {
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)

  const load = useCallback(async () => {
    generation.current += 1
    const gen = generation.current
    setLoading(true)
    try {
      const fetched = await apiFetch<Job>(jobApiPath(projectId, jobId))
      if (gen === generation.current) {
        setJob(fetched)
        setError(null)
      }
    } catch (caught) {
      if (gen === generation.current) {
        setError(errorMessage(caught))
      }
    } finally {
      if (gen === generation.current) {
        setLoading(false)
      }
    }
  }, [projectId, jobId])

  useEffect(() => {
    setJob(null)
    void load()
    return () => {
      generation.current += 1
    }
  }, [load])

  const refresh = useCallback(() => {
    void load()
  }, [load])

  const applyStatus = useCallback((data: LiveStatusData) => {
    setJob((current) =>
      current === null
        ? current
        : { ...current, status: data.status, finished_at: data.finished_at },
    )
  }, [])

  return { job, loading, error, refresh, applyStatus }
}
