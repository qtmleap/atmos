// State of a cursor-paginated list (docs/SPEC.md §0.4 `Page<T>`), as a pure
// reducer so the paging rules can be tested without React.
import type { Page } from '@/shared/types'

export interface PagedListState<T> {
  items: T[]
  /** Cursor for the next request; null once the last page has arrived. */
  nextCursor: string | null
  /** True until the first page has arrived (or failed). */
  initial: boolean
  loading: boolean
  error: string | null
}

export type PagedListAction<T> =
  | { type: 'reset' }
  | { type: 'request' }
  | { type: 'page'; page: Page<T> }
  | { type: 'failure'; message: string }

export const initialPagedList = <T>(): PagedListState<T> => ({
  items: [],
  nextCursor: null,
  initial: true,
  loading: false,
  error: null,
})

export const pagedListReducer = <T>(
  state: PagedListState<T>,
  action: PagedListAction<T>,
): PagedListState<T> => {
  switch (action.type) {
    case 'reset':
      return initialPagedList()
    case 'request':
      return { ...state, loading: true, error: null }
    case 'page':
      return {
        items: [...state.items, ...action.page.items],
        nextCursor: action.page.next_cursor,
        initial: false,
        loading: false,
        error: null,
      }
    case 'failure':
      return { ...state, initial: false, loading: false, error: action.message }
  }
}

/** More pages can be requested: a cursor exists and nothing is in flight. */
export const canLoadMore = <T>(state: PagedListState<T>): boolean =>
  !state.initial && !state.loading && state.nextCursor !== null
