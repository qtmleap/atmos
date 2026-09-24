// fetch wrapper for the same-origin API (docs/SPEC.md §0.3).
//
//   const page = await apiFetch<Page<Project>>('/api/projects?limit=50')
//
// - Credentials (the Cloudflare Access cookie) are always sent.
// - A string body gets `Content-Type: application/json` unless the caller set
//   one; FormData and other bodies are passed through untouched.
// - Non-2xx responses throw ApiError carrying the SPEC error code and message.
// - An empty body (204 No Content) resolves to null, so call such endpoints as
//   apiFetch<null>(...).
import type { ErrorResponse } from '@/shared/types'

export class ApiError extends Error {
  readonly status: number
  /** SPEC §0.3 `error.code`, or `http_error` when the body is not in that shape. */
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isErrorResponse = (value: unknown): value is ErrorResponse =>
  isRecord(value) &&
  isRecord(value.error) &&
  typeof value.error.code === 'string' &&
  typeof value.error.message === 'string'

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Builds the ApiError for a non-2xx response body (already read as text). */
export const toApiError = (status: number, statusText: string, text: string): ApiError => {
  const body = parseJson(text)
  if (isErrorResponse(body)) {
    return new ApiError(status, body.error.code, body.error.message)
  }
  const message = statusText === '' ? `HTTP ${status}` : `HTTP ${status} ${statusText}`
  return new ApiError(status, 'http_error', message)
}

const withJsonContentType = (init: RequestInit | undefined): Headers => {
  const headers = new Headers(init === undefined ? undefined : init.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }
  if (init !== undefined && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: withJsonContentType(init),
    credentials: 'include',
  })
  const text = await response.text()
  if (!response.ok) {
    throw toApiError(response.status, response.statusText, text)
  }
  return text === '' ? JSON.parse('null') : JSON.parse(text)
}

/**
 * Appends query parameters, skipping undefined values and keeping any query
 * the path already has.
 * `withQuery('/api/projects', { limit: 50, cursor: undefined })` is `/api/projects?limit=50`.
 */
export const withQuery = (
  path: string,
  params: Record<string, string | number | undefined>,
): string => {
  const [pathname = '', existing = ''] = path.split('?', 2)
  const search = new URLSearchParams(existing)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query === '' ? pathname : `${pathname}?${query}`
}

/** Human readable message for anything thrown by apiFetch. */
export const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'サインインが必要です。'
    }
    if (error.status === 403) {
      return '閲覧する権限がありません。'
    }
    if (error.status === 404) {
      return '見つかりませんでした。'
    }
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return '不明なエラーが発生しました。'
}
