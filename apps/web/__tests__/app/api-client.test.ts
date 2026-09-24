import { afterEach, describe, expect, mock, test } from 'bun:test'
import {
  ApiError,
  apiFetch,
  errorMessage,
  toApiError,
  withQuery,
} from '../../src/app/lib/api-client'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

const stubFetch = (response: Response) => {
  const calls: Array<{ input: unknown; init: RequestInit | undefined }> = []
  const fake = mock(async (input: unknown, init?: RequestInit) => {
    calls.push({ input, init })
    return response
  })
  globalThis.fetch = Object.assign(fake, { preconnect: realFetch.preconnect })
  return calls
}

describe('apiFetch', () => {
  test('returns the parsed JSON body and sends credentials', async () => {
    const calls = stubFetch(Response.json({ items: [], next_cursor: null }))
    const page = await apiFetch<{ items: unknown[]; next_cursor: string | null }>('/api/projects')
    expect(page).toEqual({ items: [], next_cursor: null })
    expect(calls[0]?.input).toBe('/api/projects')
    expect(calls[0]?.init?.credentials).toBe('include')
  })

  test('sets a JSON content type for string bodies only', async () => {
    const calls = stubFetch(Response.json({}))
    await apiFetch('/api/x', { method: 'POST', body: JSON.stringify({ a: 1 }) })
    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')

    const form = stubFetch(Response.json({}))
    await apiFetch('/api/x', { method: 'PUT', body: new FormData() })
    expect(new Headers(form[0]?.init?.headers).has('Content-Type')).toBe(false)
  })

  test('resolves an empty 204 body to null', async () => {
    stubFetch(new Response(null, { status: 204 }))
    expect(await apiFetch<null>('/api/settings/tokens', { method: 'DELETE' })).toBeNull()
  })

  test('throws ApiError with the SPEC error code', async () => {
    stubFetch(
      Response.json({ error: { code: 'not_found', message: 'job not found' } }, { status: 404 }),
    )
    const error = await apiFetch('/api/projects/x/jobs/y').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'not_found', message: 'job not found' })
  })
})

describe('toApiError', () => {
  test('falls back to http_error when the body is not an ErrorResponse', () => {
    const error = toApiError(502, 'Bad Gateway', '<html>upstream</html>')
    expect(error.code).toBe('http_error')
    expect(error.message).toBe('HTTP 502 Bad Gateway')
  })
})

describe('errorMessage', () => {
  test('explains the access errors in words', () => {
    expect(errorMessage(new ApiError(401, 'unauthenticated', 'x'))).toBe('サインインが必要です。')
    expect(errorMessage(new ApiError(403, 'forbidden', 'x'))).toBe('閲覧する権限がありません。')
    expect(errorMessage(new ApiError(409, 'conflict', 'handle taken'))).toBe('handle taken')
  })
})

describe('withQuery', () => {
  test('skips undefined values and keeps an existing query', () => {
    expect(withQuery('/api/projects', { limit: 50, cursor: undefined })).toBe(
      '/api/projects?limit=50',
    )
    expect(withQuery('/api/m?kind=image', { limit: 10, cursor: 'a b' })).toBe(
      '/api/m?kind=image&limit=10&cursor=a+b',
    )
    expect(withQuery('/api/projects', {})).toBe('/api/projects')
  })
})
