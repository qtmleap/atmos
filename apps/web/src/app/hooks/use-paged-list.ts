import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { Page } from '@/shared/types'
import { apiFetch, errorMessage, withQuery } from '../lib/api-client'
import {
  canLoadMore,
  initialPagedList,
  type PagedListState,
  pagedListReducer,
} from '../lib/paged-list'

export interface PagedList<T> extends PagedListState<T> {
  hasMore: boolean
  loadMore: () => void
  /** Drops everything and loads the first page again. */
  reload: () => void
  /** Continues after an error: the next page, or the first page again if none arrived. */
  retry: () => void
}

/**
 * Loads a `Page<T>` endpoint page by page. `listPath` is the endpoint with its
 * filters already in the query (for example `/api/projects/x/jobs?status=running`);
 * when it changes, the list starts over. Responses for an old `listPath` are
 * discarded.
 */
export function usePagedList<T>(listPath: string, pageSize: number): PagedList<T> {
  const [state, dispatch] = useReducer(pagedListReducer<T>, undefined, initialPagedList<T>)
  const generation = useRef(0)
  // The reducer state only updates on the next render; this guards against a
  // second loadMore() (a scroll sentinel firing twice) in the meantime.
  const inFlight = useRef(false)

  const fetchPage = useCallback(
    async (cursor: string | undefined, gen: number) => {
      inFlight.current = true
      dispatch({ type: 'request' })
      try {
        const page = await apiFetch<Page<T>>(withQuery(listPath, { limit: pageSize, cursor }))
        if (gen === generation.current) {
          dispatch({ type: 'page', page })
        }
      } catch (error) {
        if (gen === generation.current) {
          dispatch({ type: 'failure', message: errorMessage(error) })
        }
      } finally {
        if (gen === generation.current) {
          inFlight.current = false
        }
      }
    },
    [listPath, pageSize],
  )

  const reload = useCallback(() => {
    generation.current += 1
    dispatch({ type: 'reset' })
    void fetchPage(undefined, generation.current)
  }, [fetchPage])

  useEffect(() => {
    reload()
    return () => {
      generation.current += 1
    }
  }, [reload])

  const stateRef = useRef(state)
  stateRef.current = state
  const loadMore = useCallback(() => {
    const current = stateRef.current
    if (!inFlight.current && canLoadMore(current) && current.nextCursor !== null) {
      void fetchPage(current.nextCursor, generation.current)
    }
  }, [fetchPage])

  // After a failure: a failed first page has no cursor to continue from.
  const retry = useCallback(() => {
    if (stateRef.current.nextCursor === null) {
      reload()
    } else {
      loadMore()
    }
  }, [reload, loadMore])

  return { ...state, hasMore: state.nextCursor !== null, loadMore, reload, retry }
}
