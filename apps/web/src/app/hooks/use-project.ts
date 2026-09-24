import { useEffect, useState } from 'react'
import type { Project } from '@/shared/types'
import { apiFetch, errorMessage } from '../lib/api-client'

export interface ProjectResource {
  project: Project | null
  loading: boolean
  error: string | null
}

const cache = new Map<string, Project>()

/**
 * `GET /api/projects/:project_id`. Fetched once per id and kept in memory, so
 * moving between a project's pages does not re-request the heading.
 */
export function useProject(projectId: string): ProjectResource {
  const cached = cache.get(projectId)
  const [project, setProject] = useState<Project | null>(cached === undefined ? null : cached)
  const [loading, setLoading] = useState(cached === undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const known = cache.get(projectId)
    if (known !== undefined) {
      setProject(known)
      setLoading(false)
      setError(null)
      return
    }
    const controller = { cancelled: false }
    setProject(null)
    setLoading(true)
    setError(null)
    apiFetch<Project>(`/api/projects/${encodeURIComponent(projectId)}`)
      .then((fetched) => {
        cache.set(projectId, fetched)
        if (!controller.cancelled) {
          setProject(fetched)
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

  return { project, loading, error }
}
