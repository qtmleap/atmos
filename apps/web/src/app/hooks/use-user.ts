// `GET /api/users/:handle` (docs/SPEC.md §4). Separate from the paginated
// project list (`usePagedList`) so the profile header can render as soon as
// the user itself has loaded. A response for a handle that is no longer the
// current one (moving /users/a → /users/b before a answered) is discarded.
import { useEffect, useState } from 'react'
import type { User } from '@/shared/types'
import { apiFetch, errorMessage } from '../lib/api-client'

export interface UseUserResult {
  user: User | null
  loading: boolean
  error: string | null
}

export function useUser(handle: string): UseUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = { cancelled: false }
    setUser(null)
    setLoading(true)
    setError(null)
    apiFetch<User>(`/api/users/${encodeURIComponent(handle)}`)
      .then((fetched) => {
        if (!controller.cancelled) {
          setUser(fetched)
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
  }, [handle])

  return { user, loading, error }
}
