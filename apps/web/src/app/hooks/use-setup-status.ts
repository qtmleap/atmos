// Whether atmos has ever had a user registered (`GET /api/setup`, no auth).
// Deliberately its own per-mount fetch, not a shared singleton store like
// useCurrentUser: AppLayout mounts this on every page to decide whether to
// redirect to /setup, and a singleton's "fetched once for the whole process"
// behaviour (see current-user-store.ts) would let one test's uninitialized
// result leak into every other page's test.
import { useEffect, useState } from 'react'
import type { SetupStatus } from '@/shared/types'
import { apiFetch } from '../lib/api-client'

export interface UseSetupStatusResult {
  /** null while loading, or if the request itself failed. */
  initialized: boolean | null
  loading: boolean
}

export function useSetupStatus(): UseSetupStatusResult {
  const [initialized, setInitialized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = { cancelled: false }
    setLoading(true)
    apiFetch<SetupStatus>('/api/setup')
      .then((status) => {
        if (!controller.cancelled) {
          setInitialized(status.initialized)
        }
      })
      .catch(() => {
        // Unknown is treated as "don't redirect": a broken /api/setup should
        // not lock every page behind /setup.
        if (!controller.cancelled) {
          setInitialized(null)
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
  }, [])

  return { initialized, loading }
}
