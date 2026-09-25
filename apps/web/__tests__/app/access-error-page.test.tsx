import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, screen } from '@testing-library/react'
import { restoreFetch } from './fetch-stub'
import { primeCurrentUser } from './prime-current-user'
import { renderRoute } from './render-route'
import { userWithEmail } from './user-fixtures'

const realFetch = globalThis.fetch

/** Answers /api/me with `me` (null: 401) and every project request with `status`. */
const installStatus = (status: number, me: unknown) => {
  const fake = mock(async (input: unknown) => {
    const url = new URL(String(input), 'http://localhost/')
    if (url.pathname === '/api/me') {
      return me === null
        ? Response.json({ error: { code: 'unauthenticated', message: 'x' } }, { status: 401 })
        : Response.json(me)
    }
    return Response.json({ error: { code: 'error', message: 'x' } }, { status })
  })
  globalThis.fetch = Object.assign(fake, { preconnect: realFetch.preconnect })
}

afterEach(() => {
  cleanup()
  restoreFetch()
})

describe('project access errors', () => {
  test('401 asks a signed-out visitor to log in', async () => {
    installStatus(401, null)
    await primeCurrentUser()
    await renderRoute('/projects/prj_err_401')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'ログインが必要です' }),
    ).toBeInTheDocument()
    expect(screen.getByText('401')).toBeInTheDocument()
    expect(screen.getByText('prj_err_401')).toHaveAttribute('aria-current', 'page')
    const main = screen.getByRole('main')
    expect(main.querySelector('a[href="/settings/profile"]')).toHaveTextContent('ログイン')
    expect(screen.getByRole('link', { name: 'プロジェクト一覧へ戻る' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  test('403 offers only the way back', async () => {
    installStatus(403, userWithEmail())
    await primeCurrentUser()
    await renderRoute('/projects/prj_err_403')
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'このプロジェクトを閲覧する権限がありません',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'プロジェクト一覧へ戻る' })).toBeInTheDocument()
    expect(screen.getByRole('main').querySelector('a[href="/settings/profile"]')).toBeNull()
  })

  test('404 links the project list inside the sentence', async () => {
    installStatus(404, userWithEmail())
    await primeCurrentUser()
    await renderRoute('/projects/prj_err_404')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'プロジェクトが見つかりません' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'プロジェクト一覧' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: 'プロジェクト一覧へ戻る' })).toBeNull()
  })

  test('other failures stay inline', async () => {
    installStatus(500, userWithEmail())
    await primeCurrentUser()
    await renderRoute('/projects/prj_err_500')
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0)
    expect(screen.queryByText('500')).toBeNull()
  })
})
