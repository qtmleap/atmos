import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  JobsEmptyState,
  sdkFirstJobExample,
} from '../../src/app/components/project/jobs-empty-state'
import { ProjectsEmptyState } from '../../src/app/components/project/projects-empty-state'
import { installFetch, restoreFetch } from './fetch-stub'
import { primeCurrentUser } from './prime-current-user'
import { renderInRouter, renderRoute } from './render-route'
import { user } from './user-fixtures'

afterEach(() => {
  cleanup()
  restoreFetch()
})

describe('sdkFirstJobExample', () => {
  test('quotes the project name as a Python string', () => {
    expect(sdkFirstJobExample('日本語音声合成 / VITS')).toBe(
      [
        'import atmos',
        '',
        'run = atmos.init(project="日本語音声合成 / VITS")',
        'run.log({"loss": 0.42}, step=1)',
        'run.finish()',
      ].join('\n'),
    )
    expect(sdkFirstJobExample('a "b"')).toContain('project="a \\"b\\""')
  })
})

describe('ProjectsEmptyState', () => {
  test('signed in, the one action opens the new project dialog', async () => {
    const onCreate = mock(() => {})
    await renderInRouter(<ProjectsEmptyState onCreate={onCreate} />)
    expect(
      screen.getByRole('heading', { name: 'プロジェクトはまだありません' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '新規プロジェクト' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  test('signed out, there is no action', async () => {
    await renderInRouter(<ProjectsEmptyState onCreate={null} />)
    expect(
      screen.getByRole('heading', { name: '公開プロジェクトはありません' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('JobsEmptyState', () => {
  test('links to the access token settings and shows the SDK lines', async () => {
    await renderInRouter(<JobsEmptyState projectName="VITS" />)
    expect(screen.getByRole('link', { name: 'アクセストークンを設定' })).toHaveAttribute(
      'href',
      '/settings/tokens',
    )
    expect(screen.getByText(/atmos\.init\(project="VITS"\)/)).toBeInTheDocument()
  })
})

describe('/settings/tokens?dialog=reissue', () => {
  test('opens with the reissue confirmation over the active token', async () => {
    installFetch({
      '/api/me': () => user(),
      '/api/settings/tokens': () => ({
        active: {
          id: 'tok_active_1',
          issued_at: '2026-09-24T09:42:00Z',
          revoked_at: null,
          hint: 'atmos_...w52G',
        },
      }),
    })
    await primeCurrentUser()
    await renderRoute('/settings/tokens?dialog=reissue')
    expect(
      await screen.findByRole('alertdialog', { name: 'トークンを発行し直しますか？' }),
    ).toBeInTheDocument()
  })
})
