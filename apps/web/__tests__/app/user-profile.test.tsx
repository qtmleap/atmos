import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, screen } from '@testing-library/react'
import { installFetch, restoreFetch } from './fetch-stub'
import { PROJECT_ID, project } from './fixtures'
import { primeCurrentUser } from './prime-current-user'
import { renderRoute } from './render-route'
import { user } from './user-fixtures'

afterEach(() => {
  cleanup()
  restoreFetch()
})

describe('UserProfilePage', () => {
  test('shows the profile, an edit link for your own page, and the project list', async () => {
    installFetch({
      '/api/me': () => user({ handle: 'alice', display_name: 'Alice' }),
      '/api/users/alice': () => user({ handle: 'alice', display_name: 'Alice' }),
      '/api/users/alice/projects': () => ({
        items: [project({ id: PROJECT_ID, name: '音声合成の実験' })],
        next_cursor: null,
      }),
    })
    await primeCurrentUser()
    await renderRoute('/users/alice')
    expect(await screen.findByRole('heading', { level: 1, name: 'Alice' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'プロフィールを編集' })).toHaveAttribute(
      'href',
      '/settings/profile',
    )
    expect(await screen.findByRole('link', { name: /音声合成の実験/ })).toHaveAttribute(
      'href',
      `/projects/${PROJECT_ID}`,
    )
    expect(screen.getByText('作成日 2026年9月1日')).toBeInTheDocument()
    expect(screen.getByText('1件表示 · すべて表示しました')).toBeInTheDocument()
  })

  test('shows the not-found message for an unknown user', async () => {
    installFetch({})
    await renderRoute('/users/nobody')
    expect(await screen.findByText('見つかりませんでした。')).toBeInTheDocument()
  })
})
