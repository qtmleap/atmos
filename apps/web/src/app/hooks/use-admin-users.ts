// User management for /admin (docs/SPEC.md §3). The rows come from the
// generic `usePagedList`; this hook shows them one API page at a time
// (前へ / 次へ over `next_cursor`), and adds create/role-change mutations on
// top. A create reloads the list; a role change is applied to the row in
// place, and a refusal (409 for the last admin) is kept against that row.
// The helpers above the hook are pure so they can be tested on their own.
import { useCallback, useState } from 'react'
import { z } from 'zod'
import {
  type AdminCreateUserRequest,
  HANDLE_PATTERN,
  ROLES,
  type Role,
  type UserWithEmail,
} from '@/shared/types'
import { apiFetch, errorMessage, errorStatus } from '../lib/api-client'
import { usePagedList } from './use-paged-list'

const createUserFormSchema = z.object({
  cf_access_email: z.email('メールアドレスの形式が正しくありません'),
  handle: z
    .string()
    .nonempty('handleを入力してください')
    .regex(
      HANDLE_PATTERN,
      'handleは半角英数・ハイフン・アンダースコアのみ、3〜32文字で入力してください',
    ),
  display_name: z.string().nonempty('表示名を入力してください'),
  role: z.enum(ROLES),
})

export interface CreateUserFormInput {
  cf_access_email: string
  handle: string
  display_name: string
  role: Role
}

export type CreateUserFormValidation =
  | { success: true; data: AdminCreateUserRequest }
  | { success: false; message: string }

const firstIssueMessage = (error: z.ZodError): string => {
  const [issue] = error.issues
  return issue === undefined ? '入力内容を確認してください' : issue.message
}

/** Pure validation for the "add user" form; testable without React or the network. */
export const validateCreateUserForm = (input: CreateUserFormInput): CreateUserFormValidation => {
  const result = createUserFormSchema.safeParse(input)
  if (!result.success) {
    return { success: false, message: firstIssueMessage(result.error) }
  }
  return { success: true, data: result.data }
}

/** Narrows a Radix `Select`'s `string` value to `Role` without a type assertion. */
export const isRole = (value: string): value is Role => ROLES.some((role) => role === value)

/** The toolbar's role filter: one role, or every role. */
export type RoleFilter = Role | 'all'

export const isRoleFilter = (value: string): value is RoleFilter => value === 'all' || isRole(value)

/**
 * Client-side narrowing of the loaded rows (the API has no search or role
 * query, docs/SPEC.md §3). The query matches display name, handle and e-mail,
 * case-insensitively; blank matches everything.
 */
export const filterAdminUsers = (
  items: readonly UserWithEmail[],
  query: string,
  role: RoleFilter,
): UserWithEmail[] => {
  const needle = query.trim().toLocaleLowerCase()
  return items.filter(
    (user) =>
      (role === 'all' || user.role === role) &&
      (needle === '' ||
        [user.display_name, user.handle, user.cf_access_email].some((field) =>
          field.toLocaleLowerCase().includes(needle),
        )),
  )
}

/** The rows of page `index`, given where each loaded page starts in `total` rows. */
export const pageRange = (
  starts: readonly number[],
  index: number,
  total: number,
): { start: number; end: number } => {
  const at = (position: number): number => {
    const start = starts[position]
    return start === undefined ? total : start
  }
  return { start: at(index), end: at(index + 1) }
}

/** Applies role changes the server accepted to the loaded rows. */
export const applyRoleOverrides = (
  items: readonly UserWithEmail[],
  overrides: Readonly<Record<string, Role>>,
): UserWithEmail[] =>
  items.map((user) => {
    const role = overrides[user.id]
    return role === undefined || role === user.role ? user : { ...user, role }
  })

/** What a refused role change says under its select; 409 is the last admin. */
export const roleUpdateErrorMessage = (error: unknown): string =>
  errorStatus(error) === 409 ? '最後の管理者は変更できません' : errorMessage(error)

/** A refused role change, shown under that row's select. */
export interface RoleUpdateError {
  userId: string
  message: string
}

const ADMIN_USERS_PAGE_SIZE = 50

export interface UseAdminUsersResult {
  /** The rows of the current page, before the toolbar's filter. */
  items: UserWithEmail[]
  /** The rows the table shows: `items` narrowed by `query` and `roleFilter`. */
  visibleItems: UserWithEmail[]
  query: string
  setQuery: (value: string) => void
  roleFilter: RoleFilter
  setRoleFilter: (value: RoleFilter) => void
  initial: boolean
  loading: boolean
  error: string | null
  canGoPrevious: boolean
  canGoNext: boolean
  goPrevious: () => void
  /** The next loaded page, or fetches it; after an error, tries again. */
  goNext: () => void
  creating: boolean
  createError: string | null
  createUser: (input: CreateUserFormInput) => Promise<boolean>
  updatingUserId: string | null
  updateError: RoleUpdateError | null
  updateRole: (userId: string, role: Role) => Promise<void>
}

export function useAdminUsers(): UseAdminUsersResult {
  const list = usePagedList<UserWithEmail>('/api/admin/users', ADMIN_USERS_PAGE_SIZE)
  const { initial, loading, error, hasMore, loadMore, retry } = list
  const [pageStarts, setPageStarts] = useState<number[]>([0])
  const [pageIndex, setPageIndex] = useState(0)
  const [roleOverrides, setRoleOverrides] = useState<Record<string, Role>>({})
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<RoleUpdateError | null>(null)

  const listReload = list.reload
  const reload = useCallback(() => {
    setPageStarts([0])
    setPageIndex(0)
    setRoleOverrides({})
    listReload()
  }, [listReload])

  const createUser = useCallback(
    async (input: CreateUserFormInput): Promise<boolean> => {
      const validation = validateCreateUserForm(input)
      if (!validation.success) {
        setCreateError(validation.message)
        return false
      }
      setCreating(true)
      setCreateError(null)
      try {
        await apiFetch<UserWithEmail>('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(validation.data),
        })
        reload()
        return true
      } catch (err) {
        setCreateError(errorMessage(err))
        return false
      } finally {
        setCreating(false)
      }
    },
    [reload],
  )

  const updateRole = useCallback(async (userId: string, role: Role) => {
    setUpdatingUserId(userId)
    setUpdateError(null)
    try {
      const updated = await apiFetch<UserWithEmail>(
        `/api/admin/users/${encodeURIComponent(userId)}`,
        { method: 'PATCH', body: JSON.stringify({ role }) },
      )
      setRoleOverrides((current) => ({ ...current, [userId]: updated.role }))
    } catch (err) {
      setUpdateError({ userId, message: roleUpdateErrorMessage(err) })
    } finally {
      setUpdatingUserId(null)
    }
  }, [])

  const loadedPages = pageStarts.length
  const goPrevious = useCallback(() => {
    setPageIndex((index) => Math.max(0, index - 1))
  }, [])
  const goNext = useCallback(() => {
    if (error !== null) {
      retry()
    } else if (pageIndex + 1 < loadedPages) {
      setPageIndex(pageIndex + 1)
    } else if (hasMore && !loading) {
      setPageStarts((starts) => [...starts, list.items.length])
      setPageIndex(pageIndex + 1)
      loadMore()
    }
  }, [error, retry, pageIndex, loadedPages, hasMore, loading, list.items.length, loadMore])

  const { start, end } = pageRange(pageStarts, pageIndex, list.items.length)
  const items = applyRoleOverrides(list.items.slice(start, end), roleOverrides)

  return {
    items,
    visibleItems: filterAdminUsers(items, query, roleFilter),
    query,
    setQuery,
    roleFilter,
    setRoleFilter,
    initial,
    loading,
    error,
    canGoPrevious: pageIndex > 0,
    canGoNext: pageIndex + 1 < loadedPages || hasMore || error !== null,
    goPrevious,
    goNext,
    creating,
    createError,
    createUser,
    updatingUserId,
    updateError,
    updateRole,
  }
}
