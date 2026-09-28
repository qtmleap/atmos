import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forgetCachedProject } from '../../src/app/hooks/use-project'
import { installFetch, restoreFetch } from './fetch-stub'
import { job, PROJECT_ID, project } from './fixtures'
import { renderRoute } from './render-route'

afterEach(() => {
  cleanup()
  restoreFetch()
  forgetCachedProject(PROJECT_ID)
})

describe('JobsViewNav', () => {
  const jobsPath = `/api/projects/${PROJECT_ID}/jobs`
  const projectPath = `/api/projects/${PROJECT_ID}`

  test('moves between the list and the comparison, keeping the rest of the search', async () => {
    installFetch({
      [projectPath]: () => project(),
      [jobsPath]: () => ({ items: [job({ id: 'j1', name: 'vits-baseline' })], next_cursor: null }),
    })
    await renderRoute(`/projects/${PROJECT_ID}?status=failed`)
    const nav = await screen.findByRole('navigation', { name: 'ジョブの表示' })
    const list = within(nav).getByRole('link', { name: '一覧' })
    const compare = within(nav).getByRole('link', { name: 'グラフで比較' })
    expect(list).toHaveAttribute('aria-current', 'page')
    expect(compare).not.toHaveAttribute('aria-current')
    expect(compare).toHaveAttribute('href', `/projects/${PROJECT_ID}?status=failed&view=compare`)

    await userEvent.click(compare)
    expect(await screen.findByText(/比較対象 1 \/ 1件/)).toBeInTheDocument()
    const after = screen.getByRole('navigation', { name: 'ジョブの表示' })
    expect(within(after).getByRole('link', { name: 'グラフで比較' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const back = within(after).getByRole('link', { name: '一覧' })
    expect(back).not.toHaveAttribute('aria-current')
    expect(back).toHaveAttribute('href', `/projects/${PROJECT_ID}?status=failed`)
  })

  test('a project with no job shows its empty state without the switch', async () => {
    installFetch({
      [projectPath]: () => project(),
      [jobsPath]: () => ({ items: [], next_cursor: null }),
    })
    await renderRoute(`/projects/${PROJECT_ID}`)
    expect(await screen.findByText('ジョブはまだありません')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'ジョブの表示' })).toBeNull()
  })
})
