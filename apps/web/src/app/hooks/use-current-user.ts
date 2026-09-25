import { useCallback, useSyncExternalStore } from 'react'
import type { UserWithEmail } from '@/shared/types'
import { apiFetch } from '../lib/api-client'
import { createCurrentUserStore } from '../lib/current-user-store'

const store = createCurrentUserStore(() => apiFetch<UserWithEmail>('/api/me'))

/**
 * The signed-in user from `GET /api/me`. Signed out (401) is `user: null`;
 * this hook never throws. All callers share one request, and refetch()
 * (for example after editing the profile) updates every caller.
 */
export function useCurrentUser(): {
  user: UserWithEmail | null
  loading: boolean
  refetch: () => void
} {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const refetch = useCallback(() => {
    void store.load()
  }, [])
  return { user: state.user, loading: state.loading, refetch }
}
