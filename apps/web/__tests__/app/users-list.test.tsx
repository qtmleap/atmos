import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installFetch, restoreFetch } from './fetch-stub'
import { renderRoute } from './render-route'
import { user } from './user-fixtures'

afterEach(() => {
  cleanup()
  restoreFetch()
})

describe('UsersListPage', () => {
  test('lists members and loads the next page with the cursor', async () => {
    const requested = installFetch({
      '/api/users': (url) =>
        url.searchParams.get('cursor') === 'c1'
          ? { items: [user({ id: '2', handle: 'bob', display_name: 'Bob' })], next_cursor: null }
          : { items: [user()], next_cursor: 'c1' },
    })
    await renderRoute('/users')
    expect(await screen.findByRole('link', { name: /Alice/ })).toHaveAttribute(
      'href',
      '/users/alice',
    )
    await userEvent.click(screen.getByRole('button', { name: '次へ' }))
    expect(await screen.findByText('Bob')).toBeInTheDocument()
    expect(requested).toContain('/api/users?limit=50&cursor=c1')
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()
  })

  test('narrows the loaded rows by display name or handle', async () => {
    installFetch({
      '/api/users': () => ({
        items: [user(), user({ id: '2', handle: 'bob', display_name: 'Bob' })],
        next_cursor: null,
      }),
    })
    await renderRoute('/users')
    expect(await screen.findByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('2件表示')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox', { name: '表示名・ハンドルで検索' }), 'ali')
    expect(screen.queryByText('Bob')).toBeNull()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('1件表示')).toBeInTheDocument()
  })

  test('shows the empty message', async () => {
    installFetch({ '/api/users': () => ({ items: [], next_cursor: null }) })
    await renderRoute('/users')
    expect(await screen.findByText('メンバーがいません。')).toBeInTheDocument()
  })
})
