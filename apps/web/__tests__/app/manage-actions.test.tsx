// The "…" menu of a project or job heading and its dialogs
// (designs/pages/project-jobs-menu.html, project-settings.html,
// project-delete.html, job-detail-menu.html, job-rename.html, job-delete.html).
// Who may manage what, the form checks and the delete wording are pure,
// covered by manage.test.ts; this covers who sees the menu, and what its
// dialogs and mutations do.
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forgetCachedProject } from '../../src/app/hooks/use-project'
import { restoreFetch } from './fetch-stub'
import { JOB_ID, job, PROJECT_ID, project } from './fixtures'
import { primeCurrentUser } from './prime-current-user'
import { renderRoute } from './render-route'
import { admin, userWithEmail } from './user-fixtures'

const realFetch = globalThis.fetch
const OWNER_ID = project().owner.id

type Handler = (url: URL, init: RequestInit | undefined) => unknown

/**
 * Like fetch-stub's installFetch, but keyed by "METHOD /path" so a PATCH or a
 * DELETE can answer differently than the GET of the same path. A handler
 * returning null answers 204 (DELETE); returning a Response is sent as is.
 */
const installApi = (routes: Record<string, Handler>): string[] => {
  const calls: string[] = []
  const fake = mock(async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/')
    const method = init?.method === undefined ? 'GET' : init.method
    calls.push(`${method} ${url.pathname}`)
    const handler = routes[`${method} ${url.pathname}`]
    if (handler === undefined) {
      return Response.json({ error: { code: 'not_found', message: 'not found' } }, { status: 404 })
    }
    const result = handler(url, init)
    if (result instanceof Response) {
      return result
    }
    return result === null ? new Response(null, { status: 204 }) : Response.json(result)
  })
  globalThis.fetch = Object.assign(fake, { preconnect: realFetch.preconnect })
  return calls
}

const signedOut: Handler = () =>
  new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'signed out' } }), {
    status: 401,
  })

afterEach(() => {
  cleanup()
  restoreFetch()
  // useProject caches by id at module scope so the pages under
  // /projects/:projectId stay put between navigations; without this a
  // project touched here would leak into the next test.
  forgetCachedProject(PROJECT_ID)
})

describe('project heading menu', () => {
  const projectPath = `/api/projects/${PROJECT_ID}`
  const jobsPath = `${projectPath}/jobs`

  test('the owner sees the "…" menu, and its first item reaches プロジェクトを変更', async () => {
    installApi({
      'GET /api/me': () => userWithEmail({ id: OWNER_ID }),
      [`GET ${projectPath}`]: () => project(),
      [`GET ${jobsPath}`]: () => ({ items: [], next_cursor: null }),
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}`)
    await userEvent.click(await screen.findByRole('button', { name: 'プロジェクトの操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '名前と公開範囲を変更' }))
    expect(await screen.findByRole('dialog', { name: 'プロジェクトを変更' })).toBeInTheDocument()
  })

  test('an admin sees it too, even without owning the project', async () => {
    installApi({
      'GET /api/me': () => admin(),
      [`GET ${projectPath}`]: () => project(),
      [`GET ${jobsPath}`]: () => ({ items: [], next_cursor: null }),
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}`)
    expect(await screen.findByRole('button', { name: 'プロジェクトの操作' })).toBeInTheDocument()
  })

  test('a signed-in stranger does not see it', async () => {
    installApi({
      'GET /api/me': () => userWithEmail(),
      [`GET ${projectPath}`]: () => project(),
      [`GET ${jobsPath}`]: () => ({ items: [], next_cursor: null }),
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}`)
    await screen.findByRole('heading', { level: 1, name: project().name })
    expect(screen.queryByRole('button', { name: 'プロジェクトの操作' })).toBeNull()
  })

  test('a signed-out visitor does not see it', async () => {
    installApi({
      'GET /api/me': signedOut,
      [`GET ${projectPath}`]: () => project(),
      [`GET ${jobsPath}`]: () => ({ items: [], next_cursor: null }),
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}`)
    await screen.findByRole('heading', { level: 1, name: project().name })
    expect(screen.queryByRole('button', { name: 'プロジェクトの操作' })).toBeNull()
  })

  test('?edit=1 opens プロジェクトを変更 prefilled, and saving PATCHes and updates the heading', async () => {
    installApi({
      'GET /api/me': () => userWithEmail({ id: OWNER_ID }),
      [`GET ${projectPath}`]: () => project(),
      [`GET ${jobsPath}`]: () => ({ items: [], next_cursor: null }),
      [`PATCH ${projectPath}`]: (_url, init) => {
        const body = JSON.parse(String(init?.body))
        return project({ name: body.name, visibility: body.visibility })
      },
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}?edit=1`)
    const dialog = await screen.findByRole('dialog', {
      name: 'プロジェクトを変更',
    })
    const nameField = within(dialog).getByLabelText(/プロジェクト名/)
    expect(nameField).toHaveValue(project().name)
    await userEvent.clear(nameField)
    await userEvent.type(nameField, 'voice-synthesis-v2')
    await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'voice-synthesis-v2',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('?delete=1 keeps 削除する disabled until the name is typed exactly, then deletes and goes home', async () => {
    const calls = installApi({
      'GET /api/me': () => userWithEmail({ id: OWNER_ID }),
      [`GET ${projectPath}`]: () => project(),
      [`GET ${jobsPath}`]: () => ({ items: [], next_cursor: null }),
      [`DELETE ${projectPath}`]: () => null,
      'GET /api/projects': () => ({ items: [], next_cursor: null }),
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}?delete=1`)
    const dialog = await screen.findByRole('alertdialog', {
      name: 'プロジェクトを削除',
    })
    const confirmButton = within(dialog).getByRole('button', {
      name: '削除する',
    })
    expect(confirmButton).toBeDisabled()
    const nameField = within(dialog).getByLabelText('確認のためプロジェクト名を入力')
    await userEvent.type(nameField, '違う名前')
    expect(confirmButton).toBeDisabled()
    await userEvent.clear(nameField)
    await userEvent.type(nameField, project().name)
    expect(confirmButton).toBeEnabled()

    await userEvent.click(confirmButton)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'プロジェクト' }),
    ).toBeInTheDocument()
    expect(calls).toContain(`DELETE ${projectPath}`)
  })
})

describe('job heading menu', () => {
  const projectPath = `/api/projects/${PROJECT_ID}`
  const jobsPath = `${projectPath}/jobs`
  const jobPath = `${jobsPath}/${JOB_ID}`

  const jobDetailReadRoutes = (name = 'exp1'): Record<string, Handler> => ({
    [`GET ${projectPath}`]: () => project(),
    [`GET ${jobPath}`]: () => job({ name }),
    [`GET ${jobPath}/metrics`]: () => ({ items: [], next_cursor: null }),
    [`GET ${jobPath}/media`]: () => ({ items: [], next_cursor: null }),
    [`GET ${jobPath}/logs`]: () => ({ items: [], next_cursor: null }),
  })

  test('the owner sees the "…" menu, and its first item reaches 名前を変更', async () => {
    installApi({
      'GET /api/me': () => userWithEmail({ id: OWNER_ID }),
      ...jobDetailReadRoutes(),
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}/jobs/${JOB_ID}`)
    await userEvent.click(await screen.findByRole('button', { name: 'ジョブの操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '名前を変更' }))
    expect(await screen.findByRole('dialog', { name: '名前を変更' })).toBeInTheDocument()
  })

  test('an admin sees it too, even without owning the project', async () => {
    installApi({
      'GET /api/me': () => admin(),
      ...jobDetailReadRoutes(),
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}/jobs/${JOB_ID}`)
    expect(await screen.findByRole('button', { name: 'ジョブの操作' })).toBeInTheDocument()
  })

  test('a signed-in stranger does not see it', async () => {
    installApi({
      'GET /api/me': () => userWithEmail(),
      ...jobDetailReadRoutes(),
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}/jobs/${JOB_ID}`)
    await screen.findByRole('heading', { level: 1, name: 'exp1' })
    expect(screen.queryByRole('button', { name: 'ジョブの操作' })).toBeNull()
  })

  test('?rename=1 opens 名前を変更 prefilled, and saving PATCHes and updates the heading', async () => {
    let currentName = 'exp1'
    installApi({
      'GET /api/me': () => userWithEmail({ id: OWNER_ID }),
      [`GET ${projectPath}`]: () => project(),
      [`GET ${jobPath}`]: () => job({ name: currentName }),
      [`GET ${jobPath}/metrics`]: () => ({ items: [], next_cursor: null }),
      [`GET ${jobPath}/media`]: () => ({ items: [], next_cursor: null }),
      [`GET ${jobPath}/logs`]: () => ({ items: [], next_cursor: null }),
      [`PATCH ${jobPath}`]: (_url, init) => {
        const body = JSON.parse(String(init?.body))
        currentName = body.name
        return job({ name: currentName })
      },
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}/jobs/${JOB_ID}?rename=1`)
    const dialog = await screen.findByRole('dialog', { name: '名前を変更' })
    const nameField = within(dialog).getByLabelText(/ジョブ名/)
    expect(nameField).toHaveValue('exp1')
    await userEvent.clear(nameField)
    await userEvent.type(nameField, 'vits-baseline-042')
    await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'vits-baseline-042',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('?delete=1 deletes the job and returns to its project', async () => {
    const calls = installApi({
      'GET /api/me': () => userWithEmail({ id: OWNER_ID }),
      ...jobDetailReadRoutes(),
      [`DELETE ${jobPath}`]: () => null,
      [`GET ${jobsPath}`]: () => ({ items: [], next_cursor: null }),
    })
    await primeCurrentUser()
    await renderRoute(`/projects/${PROJECT_ID}/jobs/${JOB_ID}?delete=1`)
    const dialog = await screen.findByRole('alertdialog', {
      name: 'ジョブを削除',
    })
    await userEvent.click(within(dialog).getByRole('button', { name: '削除する' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: project().name }),
    ).toBeInTheDocument()
    expect(calls).toContain(`DELETE ${jobPath}`)
  })
})
