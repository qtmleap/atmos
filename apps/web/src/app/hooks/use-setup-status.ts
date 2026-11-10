// Whether atmos has ever had a user registered (`GET /api/setup`).
// Deliberately its own per-mount fetch, not a shared singleton store like
// useCurrentUser: AppLayout mounts this on every page to decide whether to
// redirect to /setup, and a singleton's "fetched once for the whole process"
// behaviour (see current-user-store.ts) would let one test's uninitialized
// result leak into every other page's test.
//
// It waits for `GET /api/me` first. A signed-in user is itself the proof that
// someone is registered, so the question is only asked when nobody is signed
// in (signed out, or signed in at the identity provider without an atmos user
// yet, which is the first-run case this gate exists for).
import { useEffect, useState } from 'react'
import type { SetupStatus } from '@/shared/types'
import { apiFetch } from '../lib/api-client'
import { useCurrentUser } from './use-current-user'

export interface UseSetupStatusResult {
  /** null while loading, or if the request itself failed. */
  initialized: boolean | null
  loading: boolean
}

export function useSetupStatus(): UseSetupStatusResult {
  const { user, loading: userLoading } = useCurrentUser()
  const signedIn = user !== null
  const [initialized, setInitialized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading || signedIn) {
      return undefined
    }
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
        // not lock every page behind /setup. Behind Cloudflare Access it is
        // also what a signed-out visitor gets (a redirect to the login).
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
  }, [userLoading, signedIn])

  if (signedIn) {
    return { initialized: true, loading: false }
  }
  return { initialized, loading: userLoading || loading }
}
