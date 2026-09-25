// User management for /admin (docs/SPEC.md §3). The list itself is the
// generic `usePagedList`; this hook adds create/role-change mutations on top
// and reloads the list after each one. `validateCreateUserForm` / `isRole`
// are pure so they can be tested without React or the network.
import { useCallback, useState } from 'react'
import { z } from 'zod'
import {
  type AdminCreateUserRequest,
  HANDLE_PATTERN,
  ROLES,
  type Role,
  type UserWithEmail,
} from '@/shared/types'
import { apiFetch, errorMessage } from '../lib/api-client'
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

/** How many of the loaded rows hold each role. */
export const countRoles = (items: readonly UserWithEmail[]): Record<Role, number> => ({
  admin: items.filter((user) => user.role === 'admin').length,
  user: items.filter((user) => user.role === 'user').length,
})

const ADMIN_USERS_PAGE_SIZE = 50

export interface UseAdminUsersResult {
  /** Every loaded row, before the toolbar's filter. */
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
  hasMore: boolean
  loadMore: () => void
  retry: () => void
  creating: boolean
  createError: string | null
  createUser: (input: CreateUserFormInput) => Promise<boolean>
  updatingUserId: string | null
  updateError: string | null
  updateRole: (userId: string, role: Role) => Promise<void>
}

export function useAdminUsers(): UseAdminUsersResult {
  const { items, initial, loading, error, hasMore, loadMore, retry, reload } =
    usePagedList<UserWithEmail>('/api/admin/users', ADMIN_USERS_PAGE_SIZE)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

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

  const updateRole = useCallback(
    async (userId: string, role: Role) => {
      setUpdatingUserId(userId)
      setUpdateError(null)
      try {
        await apiFetch<UserWithEmail>(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        })
        reload()
      } catch (err) {
        setUpdateError(errorMessage(err))
      } finally {
        setUpdatingUserId(null)
      }
    },
    [reload],
  )

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
    hasMore,
    loadMore,
    retry,
    creating,
    createError,
    createUser,
    updatingUserId,
    updateError,
    updateRole,
  }
}
