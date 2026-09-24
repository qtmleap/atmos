import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, screen } from '@testing-library/react'
import { validateAvatarFile, validateProfileForm } from '../../src/app/hooks/use-profile-form'
import { installFetch, restoreFetch } from './fetch-stub'
import { primeCurrentUser } from './prime-current-user'
import { renderRoute } from './render-route'
import { userWithEmail } from './user-fixtures'

afterEach(() => {
  cleanup()
  restoreFetch()
})

describe('validateProfileForm', () => {
  test('accepts a display name and a well-formed handle', () => {
    expect(validateProfileForm({ display_name: 'Alice', handle: 'alice-2' })).toEqual({
      success: true,
      data: { display_name: 'Alice', handle: 'alice-2' },
    })
  })

  test('rejects an empty display name', () => {
    const result = validateProfileForm({ display_name: '', handle: 'alice' })
    expect(result.success).toBe(false)
  })

  test('rejects a handle with disallowed characters', () => {
    const result = validateProfileForm({ display_name: 'Alice', handle: 'a b' })
    expect(result.success).toBe(false)
  })

  test('rejects a handle shorter than 3 characters', () => {
    const result = validateProfileForm({ display_name: 'Alice', handle: 'ab' })
    expect(result.success).toBe(false)
  })
})

describe('validateAvatarFile', () => {
  test('accepts an allowed content type under the size limit', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 1024 })).toEqual({ valid: true })
  })

  test('rejects a disallowed content type', () => {
    const result = validateAvatarFile({ type: 'image/gif', size: 1024 })
    expect(result.valid).toBe(false)
  })

  test('rejects a file over 2MB', () => {
    const result = validateAvatarFile({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })
    expect(result.valid).toBe(false)
  })
})

describe('SettingsProfilePage', () => {
  test('asks a signed-out visitor to sign in', async () => {
    installFetch({})
    await primeCurrentUser()
    await renderRoute('/settings/profile')
    expect(await screen.findByText('サインインが必要です')).toBeInTheDocument()
  })

  test('fills the form from the signed-in user and shows the profile URL', async () => {
    installFetch({
      '/api/me': () => userWithEmail({ handle: 'misaki_t', display_name: '田中 美咲' }),
    })
    await primeCurrentUser()
    await renderRoute('/settings/profile')
    expect(await screen.findByLabelText('表示名')).toHaveValue('田中 美咲')
    expect(screen.getByLabelText('URL用ハンドル')).toHaveValue('misaki_t')
    expect(screen.getByText('/users/misaki_t')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '変更を保存' })).toBeInTheDocument()
  })
})
