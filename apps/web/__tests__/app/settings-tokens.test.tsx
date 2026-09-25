import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, screen, within } from '@testing-library/react'
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

const ACTIVE_TOKEN = {
  id: 'tok_active_1',
  issued_at: '2026-09-24T09:42:00Z',
  revoked_at: null,
  hint: 'atmos_...w52G',
}

describe('formatIssuedAt', () => {
  test('prints the UTC date in Japanese with the time', () => {
    expect(formatIssuedAt('2026-09-24T09:42:00Z')).toBe('2026年9月24日 09:42 UTC')
  })
})

describe('SettingsTokensPage', () => {
  test('a reload shows the stored token by its first and last characters, without a dialog', async () => {
    installFetch({
      '/api/me': () => user(),
      '/api/settings/tokens': () => ({ active: ACTIVE_TOKEN }),
    })
    await primeCurrentUser()
    await renderRoute('/settings/tokens')

    expect(await screen.findByText('有効なトークンがあります')).toBeInTheDocument()
    expect(screen.getByText('発行日時：2026年9月24日 09:42 UTC')).toBeInTheDocument()
    expect(screen.getByText('有効なトークン 1 / 1')).toBeInTheDocument()
    expect(screen.getByText('atmos_...w52G')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('a token issued before hints were stored says so instead of a hint', async () => {
    installFetch({
      '/api/me': () => user(),
      '/api/settings/tokens': () => ({ active: { ...ACTIVE_TOKEN, hint: null } }),
    })
    await primeCurrentUser()
    await renderRoute('/settings/tokens')

    expect(await screen.findByText('（先頭と末尾の文字は記録されていません）')).toBeInTheDocument()
  })

  test('issues a token and shows it once, with no prior active token', async () => {
    const tokenCalls: unknown[] = []
    installFetch({
      '/api/me': () => user(),
      '/api/settings/tokens': () => {
        tokenCalls.push(null)
        return tokenCalls.length === 1
          ? { active: null }
          : accessTokenCreated({ token: 'atmos_sk_abcdef' })
      },
    })
    await primeCurrentUser()
    await renderRoute('/settings/tokens')
    expect(await screen.findByText('トークンを発行できます')).toBeInTheDocument()
    expect(screen.queryByText('有効なトークン 1 / 1')).not.toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: '新しいトークンを発行' }))
    expect(await screen.findByText('atmos_sk_abcdef')).toBeInTheDocument()
    expect(screen.getByText('トークンを発行しました')).toBeInTheDocument()
    expect(screen.getByText(/平文トークンはこの一度だけ表示されます/)).toBeInTheDocument()
    expect(screen.getByText('発行日時：2026年9月24日 00:00 UTC')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('reissuing an active token asks for confirmation; cancel keeps the old one, confirm issues a new one', async () => {
    const tokenCalls: unknown[] = []
    installFetch({
      '/api/me': () => user(),
      '/api/settings/tokens': () => {
        tokenCalls.push(null)
        return tokenCalls.length === 1
          ? { active: ACTIVE_TOKEN }
          : accessTokenCreated({ id: 'tok_new', token: 'atmos_sk_new_token' })
      },
    })
    await primeCurrentUser()
    await renderRoute('/settings/tokens')
    await screen.findByText('有効なトークンがあります')

    await userEvent.click(screen.getByRole('button', { name: '新しいトークンを発行' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'トークンを発行し直しますか？' })
    expect(
      within(dialog).getByText(
        '2026年9月24日 09:42 UTC に発行した今のトークン（atmos_...w52G）はすぐに失効し、それを使っている SDK からの送信はできなくなります。',
      ),
    ).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'キャンセル' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText('有効なトークンがあります')).toBeInTheDocument()
    expect(tokenCalls).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: '新しいトークンを発行' }))
    await userEvent.click(await screen.findByRole('button', { name: '発行し直す' }))
    expect(await screen.findByText('atmos_sk_new_token')).toBeInTheDocument()
    expect(screen.getByText('トークンを発行しました')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('revoking clears the active token and disables the revoke button', async () => {
    installFetch({
      '/api/me': () => user(),
      '/api/settings/tokens': () => ({ active: ACTIVE_TOKEN }),
    })
    await primeCurrentUser()
    await renderRoute('/settings/tokens')
    await screen.findByText('有効なトークンがあります')
    const revokeButton = screen.getByRole('button', { name: 'トークンを失効' })
    expect(revokeButton).toBeEnabled()

    await userEvent.click(revokeButton)
    expect(await screen.findByText('トークンを失効しました。')).toBeInTheDocument()
    expect(screen.queryByText('有効なトークン 1 / 1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'トークンを失効' })).toBeDisabled()
  })

  test('with no active token, issuing skips the confirmation dialog and revoke is disabled', async () => {
    const tokenCalls: unknown[] = []
    installFetch({
      '/api/me': () => user(),
      '/api/settings/tokens': () => {
        tokenCalls.push(null)
        return tokenCalls.length === 1
          ? { active: null }
          : accessTokenCreated({ token: 'atmos_sk_abcdef' })
      },
    })
    await primeCurrentUser()
    await renderRoute('/settings/tokens')
    expect(await screen.findByText('トークンを発行できます')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'トークンを失効' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: '新しいトークンを発行' }))
    expect(await screen.findByText('atmos_sk_abcdef')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('asks a signed-out visitor to sign in', async () => {
    installFetch({})
    await primeCurrentUser()
    await renderRoute('/settings/tokens')
    expect(await screen.findByText('サインインが必要です')).toBeInTheDocument()
  })
})
