import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatIssuedAt } from '../../src/app/hooks/use-access-token'
import { installFetch, restoreFetch } from './fetch-stub'
import { primeCurrentUser } from './prime-current-user'
import { renderRoute } from './render-route'
import { accessTokenCreated, user } from './user-fixtures'

afterEach(() => {
  cleanup()
  restoreFetch()
})

describe('formatIssuedAt', () => {
  test('prints the UTC date in Japanese with the time', () => {
    expect(formatIssuedAt('2026-09-24T09:42:00Z')).toBe('2026年9月24日 09:42 UTC')
  })
})

describe('SettingsTokensPage', () => {
  test('issues a token and shows it once', async () => {
    installFetch({
      '/api/me': () => user(),
      '/api/settings/tokens': () => accessTokenCreated({ token: 'atmos_sk_abcdef' }),
    })
    await primeCurrentUser()
    await renderRoute('/settings/tokens')
    await userEvent.click(await screen.findByRole('button', { name: '新しいトークンを発行' }))
    expect(await screen.findByText('atmos_sk_abcdef')).toBeInTheDocument()
    expect(screen.getByText('トークンを発行しました')).toBeInTheDocument()
    expect(screen.getByText(/平文トークンはこの一度だけ表示されます/)).toBeInTheDocument()
    expect(screen.getByText('発行日時：2026年9月24日 00:00 UTC')).toBeInTheDocument()
  })

  test('asks a signed-out visitor to sign in', async () => {
    installFetch({})
    await primeCurrentUser()
    await renderRoute('/settings/tokens')
    expect(await screen.findByText('サインインが必要です')).toBeInTheDocument()
  })
})
