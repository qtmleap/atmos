// Response helpers for tests. `Response.json()` is typed differently by the
// Bun and workers type packages; reading the body as `unknown` sidesteps both.
import { expect } from 'bun:test'
import type { z } from 'zod'
import { errorResponseSchema } from '../../src/shared/schemas'
import type { ErrorCode, ErrorResponse } from '../../src/shared/types'

export const jsonOf = async (response: { text: () => Promise<string> }): Promise<unknown> =>
  JSON.parse(await response.text())

/**
 * Asserts `body` matches the docs/SPEC.md response `schema` and returns the
 * parsed value. Failures list every issue, so a drifted field is named.
 */
export const expectShape = <T extends z.ZodType>(schema: T, body: unknown): z.output<T> => {
  const result = schema.safeParse(body)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`response does not match schema:\n${issues}`)
  }
  return result.data
}

/** Reads a JSON body and asserts it matches `schema`. */
export const jsonShaped = async <T extends z.ZodType>(
  schema: T,
  response: { text: () => Promise<string> },
): Promise<z.output<T>> => expectShape(schema, await jsonOf(response))

/** Reads a JSON error body, asserts the SPEC §0.3 shape and the expected `code`. */
export const jsonError = async (
  response: { text: () => Promise<string> },
  code: ErrorCode,
): Promise<ErrorResponse> => {
  const body = expectShape(errorResponseSchema, await jsonOf(response))
  expect(body.error.code).toBe(code)
  return body
}
