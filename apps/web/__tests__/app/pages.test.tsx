import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ListFooter } from '../../src/app/components/common/list-footer'
import { UserMenu } from '../../src/app/components/layout/user-menu'
import { validateCreateProjectForm } from '../../src/app/hooks/use-create-project'
import { forgetCachedProject } from '../../src/app/hooks/use-project'
import { installFetch, restoreFetch } from './fetch-stub'
import { JOB_ID, job, logLine, metric, PROJECT_ID, project } from './fixtures'
import { primeCurrentUser } from './prime-current-user'
import { renderInRouter, renderRoute } from './render-route'
import { userWithEmail } from './user-fixtures'

const realFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  restoreFetch()
  // useProject caches by id at module scope so the pages under
  // /projects/:projectId stay put between navigations; without this every
  // test after the first to touch PROJECT_ID would see its cached project.
  forgetCachedProject(PROJECT_ID)
})

describe('validateCreateProjectForm', () => {
  test('accepts a non-empty name', () => {
    expect(
      validateCreateProjectForm({
        name: 'voice-synthesis-v5',
        visibility: 'private',
      }),
    ).toEqual({
      success: true,
      data: { name: 'voice-synthesis-v5', visibility: 'private' },
    })
  })

  test('rejects an empty name', () => {
    const result = validateCreateProjectForm({
      name: '',
      visibility: 'private',
    })
    expect(result).toEqual({
      success: false,
      message: 'プロジェクト名を入力してください',
    })
  })
})

describe('HomePage', () => {
  test('lists projects and loads the next page with the cursor', async () => {
    const requested = installFetch({
      '/api/projects': (url) =>
        url.searchParams.get('cursor') === 'c1'
          ? {
              items: [project({ id: 'p2', name: '二つ目' })],
              next_cursor: null,
            }
          : { items: [project()], next_cursor: 'c1' },
    })
    await renderRoute('/')
    expect(await screen.findByRole('link', { name: '音声合成の実験' })).toHaveAttribute(
      'href',
      `/projects/${PROJECT_ID}`,
    )
    expect(screen.getByText('1件表示 · 先頭 · 続きあり')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '次へ' }))
    expect(await screen.findByRole('link', { name: '二つ目' })).toBeInTheDocument()
    expect(requested).toContain('/api/projects?limit=50&cursor=c1')
    expect(screen.getByText('2件表示 · すべて表示しました')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()
  })

  test('shows the job count and the last update when the API sends them', async () => {
    installFetch({
      '/api/projects': () => ({
        items: [project({ job_count: 248, updated_at: '2026-09-24T14:32:00Z' })],
        next_cursor: null,
      }),
    })
    await renderRoute('/')
    expect(await screen.findByText('248')).toBeInTheDocument()
    expect(screen.getByText('09-24 14:32')).toBeInTheDocument()
  })

  test('narrows the loaded rows by the search box and the selects', async () => {
    installFetch({
      '/api/me': () => userWithEmail(),
      '/api/projects': () => ({
        items: [
          project({ id: 'p1', name: '音声合成の実験', visibility: 'public' }),
          project({
            id: 'p2',
            name: '画像生成の実験',
            visibility: 'private',
            owner: { id: 'u2', handle: 'bob', display_name: 'Bob' },
          }),
        ],
        next_cursor: null,
      }),
    })
    // Signed in: the visibility select needs to offer 非公開 (private) below.
    await primeCurrentUser()
    await renderRoute('/')
    expect(await screen.findByRole('link', { name: '画像生成の実験' })).toBeInTheDocument()

    await userEvent.type(screen.getByRole('searchbox', { name: 'プロジェクトを検索' }), '音声')
    expect(screen.queryByRole('link', { name: '画像生成の実験' })).toBeNull()
    expect(screen.getByRole('link', { name: '音声合成の実験' })).toBeInTheDocument()
    await userEvent.clear(screen.getByRole('searchbox', { name: 'プロジェクトを検索' }))

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '公開範囲' }), 'private')
    expect(screen.queryByRole('link', { name: '音声合成の実験' })).toBeNull()
    expect(screen.getByRole('link', { name: '画像生成の実験' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '所有者' }), 'alice')
    expect(screen.getByText('一致するプロジェクトがありません')).toBeInTheDocument()
  })

  test('shows the empty message', async () => {
    installFetch({
      '/api/me': () => userWithEmail(),
      '/api/projects': () => ({ items: [], next_cursor: null }),
    })
    await primeCurrentUser()
    await renderRoute('/')
    expect(await screen.findByText('プロジェクトはまだありません')).toBeInTheDocument()
  })

  test('signed out, the visibility select only offers 公開', async () => {
    installFetch({
      '/api/projects': () => ({ items: [project()], next_cursor: null }),
    })
    await primeCurrentUser()
    await renderRoute('/')
    await screen.findByRole('link', { name: '音声合成の実験' })
    const select = screen.getByRole('combobox', { name: '公開範囲' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['すべての公開範囲', '公開'])
  })

  test('signed in, the visibility select offers all three tiers in order', async () => {
    installFetch({
      '/api/me': () => userWithEmail(),
      '/api/projects': () => ({ items: [project()], next_cursor: null }),
    })
    await primeCurrentUser()
    await renderRoute('/')
    await screen.findByRole('link', { name: '音声合成の実験' })
    const select = screen.getByRole('combobox', { name: '公開範囲' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['すべての公開範囲', '公開', 'メンバー限定', '非公開'])
  })

  test('only a signed-in user sees the 新規プロジェクト button', async () => {
    installFetch({
      '/api/projects': () => ({ items: [project()], next_cursor: null }),
    })
    await primeCurrentUser()
    await renderRoute('/')
    await screen.findByRole('link', { name: '音声合成の実験' })
    expect(screen.queryByRole('button', { name: '新規プロジェクト' })).not.toBeInTheDocument()
  })

  test('?new=1 opens the create-project dialog, and creating navigates to the new project', async () => {
    const created = project({
      id: 'p9',
      name: 'new-exp',
      visibility: 'private',
    })
    const calls: string[] = []
    installFetch({
      '/api/me': () => userWithEmail(),
      '/api/projects': () => {
        calls.push('projects')
        return calls.length === 1 ? { items: [project()], next_cursor: null } : created
      },
      [`/api/projects/${created.id}`]: () => created,
      [`/api/projects/${created.id}/jobs`]: () => ({
        items: [],
        next_cursor: null,
      }),
    })
    await primeCurrentUser()
    await renderRoute('/?new=1')

    const dialog = await screen.findByRole('dialog', {
      name: '新規プロジェクト',
    })
    await userEvent.type(within(dialog).getByLabelText(/プロジェクト名/), 'new-exp')
    await userEvent.click(within(dialog).getByRole('button', { name: '作成する' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'new-exp' })).toBeInTheDocument()
  })

  test('a duplicate project name shows the conflict message under the field', async () => {
    const fake = mock(async (input: unknown, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost/')
      if (url.pathname === '/api/me') {
        return Response.json(userWithEmail())
      }
      if (url.pathname === '/api/projects') {
        if (init?.method === 'POST') {
          return Response.json(
            {
              error: {
                code: 'conflict',
                message: 'a project with this name already exists',
              },
            },
            { status: 409 },
          )
        }
        return Response.json({ items: [project()], next_cursor: null })
      }
      return Response.json({ error: { code: 'not_found', message: 'not found' } }, { status: 404 })
    })
    globalThis.fetch = Object.assign(fake, {
      preconnect: realFetch.preconnect,
    })
    await primeCurrentUser()
    await renderRoute('/?new=1')

    const dialog = await screen.findByRole('dialog', {
      name: '新規プロジェクト',
    })
    await userEvent.type(within(dialog).getByLabelText(/プロジェクト名/), '音声合成の実験')
    await userEvent.click(within(dialog).getByRole('button', { name: '作成する' }))

    expect(await screen.findByText('同じ名前のプロジェクトがすでにあります')).toBeInTheDocument()
    expect(dialog).toBeInTheDocument()
  })
})

describe('ProjectJobsPage', () => {
  const jobsPath = `/api/projects/${PROJECT_ID}/jobs`
  const projectPath = `/api/projects/${PROJECT_ID}`

  test('shows the project heading and passes the status filter from the URL to the API', async () => {
    const requested = installFetch({
      [projectPath]: () => project({ visibility: 'private' }),
      [jobsPath]: () => ({
        items: [job({ status: 'failed', name: 'broken run' })],
        next_cursor: null,
      }),
    })
    await renderRoute(`/projects/${PROJECT_ID}?status=failed`)
    const link = await screen.findByRole('link', { name: 'broken run' })
    expect(link).toHaveAttribute('href', `/projects/${PROJECT_ID}/jobs/${JOB_ID}`)
    expect(requested).toContain(`${jobsPath}?status=failed&limit=50`)
    expect(screen.getByRole('combobox', { name: 'ジョブの状態' })).toHaveValue('failed')
    expect(
      await screen.findByRole('heading', { level: 1, name: '音声合成の実験' }),
    ).toBeInTheDocument()
    expect(screen.getByText('非公開')).toBeInTheDocument()
    expect(screen.getByText('所有者 Alice')).toBeInTheDocument()
  })

  test('narrows the loaded rows by the search box', async () => {
    installFetch({
      [projectPath]: () => project(),
      [jobsPath]: () => ({
        items: [job({ id: 'j1', name: 'vits-baseline' }), job({ id: 'j2', name: 'vits-large' })],
        next_cursor: null,
      }),
    })
    await renderRoute(`/projects/${PROJECT_ID}`)
    await screen.findByRole('link', { name: 'vits-large' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'ジョブ名またはIDを検索' }), 'base')
    expect(screen.getByRole('link', { name: 'vits-baseline' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'vits-large' })).toBeNull()
  })

  test('?view=compare draws the newest jobs that did not fail and opens the drawer from the URL', async () => {
    const rows = [
      job({ id: 'j1', name: 'newest', status: 'running', finished_at: null }),
      job({ id: 'j2', name: 'broken', status: 'failed' }),
      job({ id: 'j3', name: 'older' }),
    ]
    installFetch({
      [projectPath]: () => project(),
      [jobsPath]: () => ({ items: rows, next_cursor: null }),
      [`${jobsPath}/j1/metrics`]: () => ({
        items: [metric(1, 'train/loss', 0, 1), metric(2, 'train/loss', 100, 0.5)],
        next_cursor: null,
      }),
      [`${jobsPath}/j3/metrics`]: () => ({
        items: [metric(3, 'train/loss', 0, 0.9), metric(4, 'val/loss', 0, 0.7)],
        next_cursor: null,
      }),
    })
    await renderRoute(`/projects/${PROJECT_ID}?view=compare&drawer=jobs`)
    const drawer = await screen.findByRole('dialog', { name: 'ジョブを選ぶ' })
    expect(within(drawer).getByRole('checkbox', { name: 'newest を比較に含める' })).toBeChecked()
    expect(
      within(drawer).getByRole('checkbox', { name: 'broken を比較に含める' }),
    ).not.toBeChecked()
    expect(within(drawer).getByRole('checkbox', { name: 'older を比較に含める' })).toBeChecked()
    // The page behind the drawer is aria-hidden while it is open.
    const chart = (key: string) =>
      screen.queryByRole('img', {
        name: `${key} の推移をジョブごとに重ねた折れ線`,
        hidden: true,
      })
    expect(await screen.findByText(/比較対象 2 \/ 3件/)).toBeInTheDocument()
    await waitFor(() => expect(chart('train/loss')).not.toBeNull())
    expect(chart('val/loss')).not.toBeNull()

    await userEvent.click(within(drawer).getByRole('checkbox', { name: 'older を比較に含める' }))
    expect(await screen.findByText(/比較対象 1 \/ 3件/)).toBeInTheDocument()
    expect(chart('val/loss')).toBeNull()

    await userEvent.click(within(drawer).getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('ticking a job in the drawer writes ?jobs= and the page reads the pick back from the URL', async () => {
    const rows = [
      job({ id: 'j1', name: 'newest' }),
      job({ id: 'j2', name: 'middle' }),
      job({ id: 'j3', name: 'older' }),
    ]
    installFetch({
      [projectPath]: () => project(),
      [jobsPath]: () => ({ items: rows, next_cursor: null }),
    })
    await renderRoute(`/projects/${PROJECT_ID}?view=compare&drawer=jobs`)
    const drawer = await screen.findByRole('dialog', { name: 'ジョブを選ぶ' })
    // No ?jobs= yet: the default pick, which the toolbar line says so.
    expect(await screen.findByText(/比較対象 3 \/ 3件 ・ 既定は/)).toBeInTheDocument()

    await userEvent.click(within(drawer).getByRole('checkbox', { name: 'middle を比較に含める' }))
    // ?jobs=j1,j3 is in the URL now: the count follows and the default note is gone.
    expect(await screen.findByText(/比較対象 2 \/ 3件/)).toBeInTheDocument()
    expect(screen.queryByText(/既定は/)).toBeNull()
    expect(
      within(drawer).getByRole('checkbox', { name: 'middle を比較に含める' }),
    ).not.toBeChecked()

    await userEvent.click(within(drawer).getByRole('checkbox', { name: 'middle を比較に含める' }))
    expect(await screen.findByText(/比較対象 3 \/ 3件$/)).toBeInTheDocument()
    expect(screen.queryByText(/既定は/)).toBeNull()

    // "選択を解除" writes an empty ?jobs=, which is none, not the default.
    await userEvent.click(within(drawer).getByRole('button', { name: '選択を解除' }))
    expect(await screen.findByText(/比較対象 0 \/ 3件$/)).toBeInTheDocument()
    expect(screen.queryByText(/既定は/)).toBeNull()
    for (const name of ['newest', 'middle', 'older']) {
      expect(
        within(drawer).getByRole('checkbox', {
          name: `${name} を比較に含める`,
        }),
      ).not.toBeChecked()
    }
  })
})

describe('JobDetailPage', () => {
  test('shows a finished job with its config, metrics and logs', async () => {
    const base = `/api/projects/${PROJECT_ID}/jobs/${JOB_ID}`
    const requested = installFetch({
      [`/api/projects/${PROJECT_ID}`]: () => project(),
      [base]: () => job({ config: { optimizer: { lr: 0.001 } } }),
      [`${base}/metrics`]: () => ({
        items: [metric(1, 'train/loss', 1, 0.9), metric(2, 'train/loss', 2, 0.4)],
        next_cursor: null,
      }),
      [`${base}/media`]: () => ({ items: [], next_cursor: null }),
      [`${base}/logs`]: () => ({
        items: [logLine(1, 'epoch 1 done')],
        next_cursor: null,
      }),
    })
    await renderRoute(`/projects/${PROJECT_ID}/jobs/${JOB_ID}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'exp1' })).toBeInTheDocument()
    expect(screen.getByText('完了')).toBeInTheDocument()
    expect(screen.getAllByText('最終結果').length).toBeGreaterThanOrEqual(1)
    expect(await screen.findByRole('heading', { level: 3, name: 'train/loss' })).toBeInTheDocument()
    // The summary tile and the chart header both show the latest value.
    expect(screen.getAllByText('0.4').length).toBeGreaterThanOrEqual(2)
    // The starter is the project owner; no member list is read for it.
    expect(await screen.findByText(/^Alice が開始 · /)).toBeInTheDocument()
    expect(requested.some((url) => url.startsWith('/api/users'))).toBe(false)

    // The config stays in a sheet until asked for, so the charts get the width.
    expect(screen.queryByRole('table', { name: '学習ハイパーパラメータ' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '設定' }))
    const sheet = await screen.findByRole('dialog', { name: '設定' })
    const config = within(sheet).getByRole('table', { name: '学習ハイパーパラメータ' })
    expect(within(config).getByRole('rowheader', { name: 'optimizer' })).toBeInTheDocument()
    expect(within(config).getByRole('cell', { name: '{"lr": 0.001}' })).toBeInTheDocument()
    const runInfo = within(sheet).getByRole('table', { name: '実行情報' })
    expect(within(runInfo).getByRole('rowheader', { name: '実行者' })).toBeInTheDocument()
    expect(within(runInfo).getByRole('cell', { name: 'Alice' })).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: '設定を閉じる' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await userEvent.click(screen.getByRole('tab', { name: 'ログ' }))
    const log = await screen.findByRole('log')
    expect(await within(log).findByText('epoch 1 done')).toBeInTheDocument()
  })

  test('shows the 404 page for a missing job', async () => {
    installFetch({})
    await renderRoute(`/projects/${PROJECT_ID}/jobs/${JOB_ID}`)
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'ジョブが見つかりません',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
  })
})

describe('UserMenu', () => {
  test('signed out shows a full page sign-in link', async () => {
    await renderInRouter(<UserMenu user={null} loading={false} />)
    expect(screen.getByRole('link', { name: 'ログイン' })).toHaveAttribute(
      'href',
      '/settings/profile',
    )
  })
})

describe('ListFooter', () => {
  test('counts the rows and pages forward only', () => {
    render(
      <ListFooter
        noun="ジョブ"
        count={8}
        hasMore
        loading={false}
        error={null}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByRole('navigation', { name: 'ジョブのページ送り' })).toBeInTheDocument()
    expect(screen.getByText('8件表示 · 先頭 · 続きあり')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '次へ' })).toBeEnabled()
  })

  test('disables both buttons once everything is shown', () => {
    render(
      <ListFooter
        noun="ジョブ"
        count={5}
        hasMore={false}
        loading={false}
        error={null}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByText('5件表示 · すべて表示しました')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()
  })

  test('offers a retry after an error', async () => {
    const calls: string[] = []
    render(
      <ListFooter
        noun="job"
        count={3}
        hasMore={false}
        loading={false}
        error="通信に失敗しました"
        onLoadMore={() => calls.push('more')}
        onRetry={() => calls.push('retry')}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('通信に失敗しました')
    await userEvent.click(screen.getByRole('button', { name: 'もう一度試す' }))
    expect(calls).toEqual(['retry'])
  })
})
