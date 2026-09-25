import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import {
  applyRoleOverrides,
  pageRange,
  roleUpdateErrorMessage,
} from '../../src/app/hooks/use-admin-users'
import { ApiError } from '../../src/app/lib/api-client'
import { installFetch, restoreFetch } from './fetch-stub'
import { primeCurrentUser } from './prime-current-user'
import { renderRoute } from './render-route'
import { admin, userWithEmail } from './user-fixtures'

afterEach(() => {
  cleanup()
  restoreFetch()
})

describe('pageRange', () => {
  test('a page runs up to where the next one starts', () => {
    expect(pageRange([0, 8], 0, 12)).toEqual({ start: 0, end: 8 })
  })

  test('the last loaded page runs to the end of the rows', () => {
    expect(pageRange([0, 8], 1, 12)).toEqual({ start: 8, end: 12 })
  })

  test('a page still loading is empty', () => {
    expect(pageRange([0, 8], 1, 8)).toEqual({ start: 8, end: 8 })
  })
})

describe('applyRoleOverrides', () => {
  const rows = [admin(), userWithEmail({ id: 'u2' })]

  test('changes only the overridden rows', () => {
    const result = applyRoleOverrides(rows, { u2: 'admin' })
    expect(result.map((row) => row.role)).toEqual(['admin', 'admin'])
    expect(result[0]).toBe(rows[0])
  })

  test('no overrides keeps the rows as they are', () => {
    expect(applyRoleOverrides(rows, {})).toEqual(rows)
  })
})

describe('roleUpdateErrorMessage', () => {
  test('409 is the last admin', () => {
    const error = new ApiError(409, 'conflict', 'cannot demote the last admin')
    expect(roleUpdateErrorMessage(error)).toBe('最後の管理者は変更できません')
  })

  test('anything else keeps its message', () => {
    expect(roleUpdateErrorMessage(new Error('boom'))).toBe('boom')
  })
})

describe('AdminPage paging', () => {
  test('次へ shows the next page alone and 前へ goes back', async () => {
    installFetch({
      '/api/me': () => admin(),
      '/api/admin/users': (url: URL) =>
        url.searchParams.get('cursor') === '1'
          ? { items: [userWithEmail({ id: 'u2', display_name: '鈴木 葵' })], next_cursor: null }
          : { items: [admin()], next_cursor: '1' },
    })
    await primeCurrentUser()
    await renderRoute('/admin')
    expect(await screen.findByText('（自分）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '次へ' }))
    expect(await screen.findByText('鈴木 葵')).toBeInTheDocument()
    expect(screen.queryByText('（自分）')).toBeNull()
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '前へ' }))
    expect(await screen.findByText('（自分）')).toBeInTheDocument()
    expect(screen.queryByText('鈴木 葵')).toBeNull()
  })
})
