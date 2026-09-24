import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, screen } from '@testing-library/react'
import {
  countRoles,
  filterAdminUsers,
  isRole,
  isRoleFilter,
  validateCreateUserForm,
} from '../../src/app/hooks/use-admin-users'
import { installFetch, restoreFetch } from './fetch-stub'
import { primeCurrentUser } from './prime-current-user'
import { renderRoute } from './render-route'
import { admin, user, userWithEmail } from './user-fixtures'

afterEach(() => {
  cleanup()
  restoreFetch()
})

describe('isRole', () => {
  test('accepts the known roles', () => {
    expect(isRole('admin')).toBe(true)
    expect(isRole('user')).toBe(true)
  })

  test('rejects anything else', () => {
    expect(isRole('superadmin')).toBe(false)
    expect(isRole('')).toBe(false)
  })
})

describe('isRoleFilter', () => {
  test('accepts the roles and "all"', () => {
    expect(isRoleFilter('all')).toBe(true)
    expect(isRoleFilter('admin')).toBe(true)
    expect(isRoleFilter('everyone')).toBe(false)
  })
})

describe('filterAdminUsers / countRoles', () => {
  const rows = [
    admin(),
    userWithEmail({
      id: 'u2',
      handle: 'aoi_ml',
      display_name: '鈴木 葵',
      cf_access_email: 'aoi@example.com',
    }),
    userWithEmail({
      id: 'u3',
      handle: 'ren_t',
      display_name: '高橋 蓮',
      cf_access_email: 'ren@example.com',
    }),
  ]

  test('a blank query and "all" keep every row', () => {
    expect(filterAdminUsers(rows, '  ', 'all')).toEqual(rows)
  })

  test('matches name, handle and e-mail case-insensitively', () => {
    expect(filterAdminUsers(rows, '鈴木', 'all').map((row) => row.id)).toEqual(['u2'])
    expect(filterAdminUsers(rows, 'REN_T', 'all').map((row) => row.id)).toEqual(['u3'])
    expect(filterAdminUsers(rows, 'admin@', 'all').map((row) => row.id)).toEqual([admin().id])
  })

  test('narrows by role', () => {
    expect(filterAdminUsers(rows, '', 'admin').map((row) => row.id)).toEqual([admin().id])
    expect(filterAdminUsers(rows, '', 'user')).toHaveLength(2)
  })

  test('counts each role', () => {
    expect(countRoles(rows)).toEqual({ admin: 1, user: 2 })
  })
})

describe('validateCreateUserForm', () => {
  const valid = {
    cf_access_email: 'new@example.com',
    handle: 'newuser',
    display_name: '新規ユーザー',
    role: 'user' as const,
  }

  test('accepts a well-formed submission', () => {
    expect(validateCreateUserForm(valid)).toEqual({ success: true, data: valid })
  })

  test('rejects a malformed email', () => {
    const result = validateCreateUserForm({ ...valid, cf_access_email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  test('rejects a handle with disallowed characters', () => {
    const result = validateCreateUserForm({ ...valid, handle: 'new user' })
    expect(result.success).toBe(false)
  })

  test('rejects an empty display name', () => {
    const result = validateCreateUserForm({ ...valid, display_name: '' })
    expect(result.success).toBe(false)
  })
})

describe('AdminPage', () => {
  test('hides the controls from a non-admin', async () => {
    installFetch({ '/api/me': () => user({ role: 'user' }) })
    await primeCurrentUser()
    await renderRoute('/admin')
    expect(await screen.findByText('このページは管理者のみ利用できます')).toBeInTheDocument()
  })

  test('lists the users for an admin and marks the signed-in one', async () => {
    installFetch({
      '/api/me': () => admin(),
      '/api/admin/users': () => ({
        items: [admin(), userWithEmail({ id: 'u2', handle: 'aoi_ml', display_name: '鈴木 葵' })],
        next_cursor: null,
      }),
    })
    await primeCurrentUser()
    await renderRoute('/admin')
    expect(await screen.findByText('鈴木 葵')).toBeInTheDocument()
    expect(screen.getByText('（自分）')).toBeInTheDocument()
    expect(screen.getByText('2人')).toBeInTheDocument()
    expect(screen.getByText('管理者 1人 · メンバー 1人')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ユーザーを作成' })).toBeInTheDocument()
  })
})
