// useCurrentUser() is backed by one module-level singleton store (see
// src/app/lib/current-user-store.ts) shared by every test file `bun test`
// runs in the same process. Once it has loaded once, mounting a page again
// does not refetch, so an earlier test's cached user would otherwise leak
// into this one. Call this before rendering a page that gates on
// useCurrentUser(), with the desired /api/me stub already installed, to
// force a fresh load and make the test's outcome independent of run order.
import { renderHook, waitFor } from '@testing-library/react'
import { useCurrentUser } from '../../src/app/hooks/use-current-user'

export const primeCurrentUser = async (): Promise<void> => {
  const { result, unmount } = renderHook(() => useCurrentUser())
  result.current.refetch()
  await waitFor(() => {
    if (result.current.loading) {
      throw new Error('still loading')
    }
  })
  unmount()
}
