import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ListFooter } from '../../src/app/components/common/list-footer'
import { UserMenu } from '../../src/app/components/layout/user-menu'
import { installFetch, restoreFetch } from './fetch-stub'
import { JOB_ID, job, logLine, metric, PROJECT_ID, project } from './fixtures'
import { renderInRouter, renderRoute } from './render-route'

afterEach(() => {
  cleanup()
  restoreFetch()
})

describe('HomePage', () => {
  test('lists projects and loads the next page with the cursor', async () => {
    const requested = installFetch({
      '/api/projects': (url) =>
        url.searchParams.get('cursor') === 'c1'
          ? { items: [project({ id: 'p2', name: '二つ目' })], next_cursor: null }
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
    installFetch({ '/api/projects': () => ({ items: [], next_cursor: null }) })
    await renderRoute('/')
    expect(await screen.findByText(/閲覧できるプロジェクトはまだありません/)).toBeInTheDocument()
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
      screen.queryByRole('img', { name: `${key} の推移をジョブごとに重ねた折れ線`, hidden: true })
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
        within(drawer).getByRole('checkbox', { name: `${name} を比較に含める` }),
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
      [`${base}/logs`]: () => ({ items: [logLine(1, 'epoch 1 done')], next_cursor: null }),
    })
    await renderRoute(`/projects/${PROJECT_ID}/jobs/${JOB_ID}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'exp1' })).toBeInTheDocument()
    expect(screen.getByText('完了')).toBeInTheDocument()
    expect(screen.getByText('更新終了 · 01:02:03 UTC')).toBeInTheDocument()
    const config = screen.getByRole('table', { name: '学習ハイパーパラメータ' })
    expect(within(config).getByRole('rowheader', { name: 'optimizer' })).toBeInTheDocument()
    expect(within(config).getByRole('cell', { name: '{"lr": 0.001}' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 3, name: 'train/loss' })).toBeInTheDocument()
    // The summary tile and the chart header both show the latest value.
    expect(screen.getAllByText('0.4').length).toBeGreaterThanOrEqual(2)
    // The starter is the project owner; no member list is read for it.
    expect(await screen.findByText(/^Alice が開始 · /)).toBeInTheDocument()
    expect(screen.getByText(/^実行者\sAlice/)).toBeInTheDocument()
    expect(requested.some((url) => url.startsWith('/api/users'))).toBe(false)

    await userEvent.click(screen.getByRole('tab', { name: 'ログ' }))
    const log = await screen.findByRole('log')
    expect(await within(log).findByText('epoch 1 done')).toBeInTheDocument()
  })

  test('explains a missing job', async () => {
    installFetch({})
    await renderRoute(`/projects/${PROJECT_ID}/jobs/${JOB_ID}`)
    expect(await screen.findByRole('alert')).toHaveTextContent('見つかりませんでした。')
  })
})

describe('UserMenu', () => {
  test('signed out shows a full page sign-in link', async () => {
    await renderInRouter(<UserMenu user={null} loading={false} />)
    expect(screen.getByRole('link', { name: 'サインイン' })).toHaveAttribute(
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
