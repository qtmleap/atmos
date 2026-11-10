// Shared state behind useCurrentUser: every component that asks for the
// signed-in user reads the same `GET /api/me` result, and refetch() updates
// all of them at once.
import type { UserWithEmail } from '@/shared/types'
import { ApiError } from './api-client'

export interface CurrentUserState {
  user: UserWithEmail | null
  loading: boolean
  /**
   * Set only when the visitor is signed in at the identity provider but their
   * email has no atmos user (401 `not_registered`): the server's message, which
   * names that email. Absent otherwise, so signed out stays `{ user: null, loading: false }`.
   */
  unregistered?: string
}

export type FetchMe = () => Promise<UserWithEmail>

export interface CurrentUserStore {
  getSnapshot: () => CurrentUserState
  subscribe: (listener: () => void) => () => void
  /** Starts a request unless one is already running. Never throws. */
  load: () => Promise<void>
}

export const createCurrentUserStore = (fetchMe: FetchMe): CurrentUserStore => {
  const listeners = new Set<() => void>()
  const box: { state: CurrentUserState; pending: Promise<void> | null; started: boolean } = {
    state: { user: null, loading: true },
    pending: null,
    started: false,
  }

  const set = (state: CurrentUserState) => {
    box.state = state
    for (const listener of listeners) {
      listener()
    }
  }

  const run = async (): Promise<void> => {
    try {
      const user = await fetchMe()
      set({ user, loading: false })
    } catch (error) {
      // 401 means "not signed in"; any other failure is also shown as signed
      // out rather than thrown, so a broken /api/me never takes a page down.
      // The exception is `not_registered`: that visitor did sign in, so
      // offering the login again only sends them round in a circle.
      if (error instanceof ApiError && error.code === 'not_registered') {
        set({ user: null, loading: false, unregistered: error.message })
        return
      }
      if (!(error instanceof ApiError && error.status === 401)) {
        console.warn('GET /api/me failed', error)
      }
      set({ user: null, loading: false })
    }
  }

  const load = (): Promise<void> => {
    if (box.pending !== null) {
      return box.pending
    }
    box.started = true
    if (!box.state.loading) {
      set({ user: box.state.user, loading: true })
    }
    const pending = run().finally(() => {
      box.pending = null
    })
    box.pending = pending
    return pending
  }

  return {
    getSnapshot: () => box.state,
    subscribe: (listener) => {
      listeners.add(listener)
      if (!box.started) {
        void load()
      }
      return () => {
        listeners.delete(listener)
      }
    },
    load,
  }
}
