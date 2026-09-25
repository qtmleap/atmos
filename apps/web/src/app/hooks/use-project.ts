import { useEffect, useState } from 'react'
import type { Project } from '@/shared/types'
import { apiFetch, errorMessage, errorStatus } from '../lib/api-client'

export interface ProjectResource {
  project: Project | null
  loading: boolean
  error: string | null
  /** HTTP status of the failure, or null (loaded, loading, or no response). */
  status: number | null
}

const cache = new Map<string, Project>()
const listeners = new Set<(project: Project) => void>()

/** Replaces the cached project after an edit, updating every mounted useProject. */
export const updateCachedProject = (project: Project): void => {
  cache.set(project.id, project)
  for (const listener of listeners) {
    listener(project)
  }
}

/** Drops a deleted project, so a later visit asks the API again. */
export const forgetCachedProject = (projectId: string): void => {
  cache.delete(projectId)
}

/**
 * `GET /api/projects/:project_id`. Fetched once per id and kept in memory, so
 * moving between a project's pages does not re-request the heading. An edit
 * (updateCachedProject) reaches every caller.
 */
export function useProject(projectId: string): ProjectResource {
  const cached = cache.get(projectId)
  const [project, setProject] = useState<Project | null>(cached === undefined ? null : cached)
  const [loading, setLoading] = useState(cached === undefined)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<number | null>(null)

  useEffect(() => {
    const listener = (updated: Project) => {
      if (updated.id === projectId) {
        setProject(updated)
      }
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [projectId])

  useEffect(() => {
    const known = cache.get(projectId)
    if (known !== undefined) {
      setProject(known)
      setLoading(false)
      setError(null)
      setStatus(null)
      return
    }
    const controller = { cancelled: false }
    setProject(null)
    setLoading(true)
    setError(null)
    setStatus(null)
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
          setStatus(errorStatus(caught))
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

  return { project, loading, error, status }
}
