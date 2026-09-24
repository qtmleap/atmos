import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCurrentUser } from '../../src/app/hooks/use-current-user'
import { setupErrorMessage, validateSetupForm } from '../../src/app/hooks/use-setup-form'
import { ApiError, errorMessage } from '../../src/app/lib/api-client'
import { installFetch } from './fetch-stub'
import { primeCurrentUser } from './prime-current-user'
import { renderRoute } from './render-route'
import { setupResponse, userWithEmail } from './user-fixtures'

const realFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = realFetch
})

describe('validateSetupForm', () => {
  const valid = { init_admin_key: 'secret', handle: 'admin-taro', display_name: '管理者太郎' }

  test('accepts a well-formed submission', () => {
    expect(validateSetupForm(valid)).toEqual({ success: true, data: valid })
  })

  test('rejects a missing init_admin_key', () => {
    const result = validateSetupForm({ ...valid, init_admin_key: '' })
    expect(result.success).toBe(false)
  })

  test('rejects a handle with disallowed characters', () => {
    const result = validateSetupForm({ ...valid, handle: '管理者' })
    expect(result.success).toBe(false)
  })
})

describe('setupErrorMessage', () => {
  test('passes an ApiError message through verbatim, unlike errorMessage', () => {
    const alreadyInitialized = new ApiError(403, 'already_initialized', 'already initialized')
    expect(setupErrorMessage(alreadyInitialized)).toBe('already initialized')
    // errorMessage overrides 403s with a generic message; that would be wrong here.
    expect(errorMessage(alreadyInitialized)).toBe('閲覧する権限がありません。')
  })

  test('falls back to errorMessage for a non-ApiError failure', () => {
    expect(setupErrorMessage(new Error('boom'))).toBe('boom')
  })
})

describe('SetupPage', () => {
  test('shows the closed state when the server answers already_initialized', async () => {
    const fake = mock(async () =>
      Response.json(
        { error: { code: 'already_initialized', message: 'すでに初期化されています。' } },
        { status: 403 },
      ),
    )
    globalThis.fetch = Object.assign(fake, { preconnect: realFetch.preconnect })
    await primeCurrentUser()

    await renderRoute('/setup')
    await userEvent.type(await screen.findByLabelText('表示名'), '管理者太郎')
    await userEvent.type(screen.getByLabelText('URL用ハンドル'), 'admin-taro')
    await userEvent.type(screen.getByLabelText(/初期管理者キー/), 'wrong-key')
    await userEvent.click(screen.getByRole('button', { name: '最初の管理者として登録' }))

    expect(await screen.findByText('セットアップは完了しています')).toBeInTheDocument()
    expect(screen.getByText('already_initialized')).toBeInTheDocument()
  })

  test('shows the server error verbatim for a wrong key', async () => {
    const fake = mock(async (input: unknown) =>
      String(input).includes('/api/setup')
        ? Response.json(
            { error: { code: 'invalid_init_key', message: 'init_admin_key does not match' } },
            { status: 401 },
          )
        : Response.json(
            { error: { code: 'unauthenticated', message: 'no user yet' } },
            { status: 401 },
          ),
    )
    globalThis.fetch = Object.assign(fake, { preconnect: realFetch.preconnect })
    await primeCurrentUser()

    await renderRoute('/setup')
    await userEvent.type(await screen.findByLabelText('表示名'), '管理者太郎')
    await userEvent.type(screen.getByLabelText('URL用ハンドル'), 'admin-taro')
    await userEvent.type(screen.getByLabelText(/初期管理者キー/), 'wrong-key')
    await userEvent.click(screen.getByRole('button', { name: '最初の管理者として登録' }))

    expect(await screen.findByText('init_admin_key does not match')).toBeInTheDocument()
  })

  test('shows the closed state to a visitor who is already signed in', async () => {
    installFetch({ '/api/me': () => userWithEmail({ role: 'admin' }) })
    await primeCurrentUser()

    await renderRoute('/setup')
    expect(await screen.findByText('セットアップは完了しています')).toBeInTheDocument()
  })

  test('refetches the current user on success, so the app reflects the new admin without a reload', async () => {
    installFetch({})
    await primeCurrentUser()

    const currentUser = renderHook(() => useCurrentUser())
    expect(currentUser.result.current.user).toBeNull()

    const newAdmin = setupResponse({
      user: userWithEmail({
        role: 'admin',
        handle: 'admin-taro',
        display_name: '管理者太郎',
      }),
    })
    installFetch({
      '/api/setup': () => newAdmin,
      '/api/me': () => newAdmin.user,
    })

    await renderRoute('/setup')
    await userEvent.type(await screen.findByLabelText('表示名'), '管理者太郎')
    await userEvent.type(screen.getByLabelText('URL用ハンドル'), 'admin-taro')
    await userEvent.type(screen.getByLabelText(/初期管理者キー/), 'secret')
    await userEvent.click(screen.getByRole('button', { name: '最初の管理者として登録' }))

    expect(await screen.findByText('初期設定が完了しました')).toBeInTheDocument()
    await waitFor(() => {
      expect(currentUser.result.current.user).not.toBeNull()
    })
    expect(currentUser.result.current.user?.display_name).toBe('管理者太郎')

    currentUser.unmount()
  })
})
