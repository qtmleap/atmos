// `GET /api/users` (docs/SPEC.md §4) page by page, plus the member search box
// applied to the pages loaded so far.
import { useMemo, useState } from 'react'
import type { User } from '@/shared/types'
import { type PagedList, usePagedList } from './use-paged-list'

export const USERS_PAGE_SIZE = 50

export function useUsers(): PagedList<User> {
  return usePagedList<User>('/api/users', USERS_PAGE_SIZE)
}

/** Members whose display name or handle contains the query (case-insensitive). */
export const filterUsers = (users: readonly User[], query: string): User[] => {
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') {
    return [...users]
  }
  return users.filter(
    (user) =>
      user.display_name.toLocaleLowerCase().includes(needle) ||
      user.handle.toLocaleLowerCase().includes(needle),
  )
}

export function useUserSearch(users: readonly User[]): {
  query: string
  setQuery: (query: string) => void
  visible: User[]
} {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => filterUsers(users, query), [users, query])
  return { query, setQuery, visible }
}
