// JSON error responses in the docs/SPEC.md §0.3 shape.
//
// Two ways to fail from a route:
//   - return errorResponse(404, 'not_found', 'job not found')
//   - throw new ApiError(404, 'not_found', 'job not found')
// Thrown ApiErrors are turned into the same response by `handleError`, which
// app.ts installs with `app.onError`. Helpers in api/lib throw, so a route can
// call them without checking a result.
import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { z } from 'zod'
import type { ErrorCode, ErrorResponse } from '../../shared/types'

export class ApiError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: ErrorCode

  constructor(status: ContentfulStatusCode, code: ErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export const errorBody = (code: ErrorCode, message: string): ErrorResponse => ({
  error: { code, message },
})

export const errorResponse = (
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
): Response => Response.json(errorBody(code, message), { status })

// Shorthands for the codes every route group uses.
export const badRequest = (message: string): ApiError =>
  new ApiError(400, 'validation_error', message)
export const unauthenticated = (message = 'authentication required'): ApiError =>
  new ApiError(401, 'unauthenticated', message)
export const forbidden = (message = 'forbidden'): ApiError =>
  new ApiError(403, 'forbidden', message)
export const notFound = (message = 'not found'): ApiError => new ApiError(404, 'not_found', message)
export const conflict = (message: string): ApiError => new ApiError(409, 'conflict', message)
export const payloadTooLarge = (message = 'payload too large'): ApiError =>
  new ApiError(413, 'payload_too_large', message)

/** One line per issue, e.g. `metrics.0.step: Invalid input: expected number`. */
export const formatZodError = (error: z.ZodError): string =>
  error.issues
    .map((issue) =>
      issue.path.length === 0 ? issue.message : `${issue.path.join('.')}: ${issue.message}`,
    )
    .join('; ')

/**
 * Validates `input` with `schema` and returns the parsed value, or throws a
 * 400 `validation_error` ApiError.
 */
export const validate = <T extends z.ZodType>(schema: T, input: unknown): z.output<T> => {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw badRequest(formatZodError(result.error))
  }
  return result.data
}

/**
 * Reads the request body as JSON and validates it. Malformed JSON is a 400
 * `validation_error` like any other schema failure.
 */
export const readJson = async <T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> => {
  const body: unknown = await request.json().catch(() => {
    throw badRequest('request body is not valid JSON')
  })
  return validate(schema, body)
}

/** `app.onError` handler: ApiError and HTTPException keep their status, anything else is a 500. */
export const handleError: ErrorHandler = (err) => {
  if (err instanceof ApiError) {
    return errorResponse(err.status, err.code, err.message)
  }
  if (err instanceof HTTPException) {
    return errorResponse(err.status, codeForStatus(err.status), err.message)
  }
  console.error(err)
  return errorResponse(500, 'internal_error', 'internal server error')
}

const codeForStatus = (status: ContentfulStatusCode): ErrorCode => {
  switch (status) {
    case 400:
      return 'validation_error'
    case 401:
      return 'unauthenticated'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 409:
      return 'conflict'
    case 413:
      return 'payload_too_large'
    default:
      return 'internal_error'
  }
}
