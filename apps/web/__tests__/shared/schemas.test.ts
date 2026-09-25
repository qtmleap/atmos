// Boundaries of the shared request/response schemas (src/shared/schemas),
// checked directly rather than through a route, so a change to a limit or a
// pattern is caught by name.
import { describe, expect, test } from 'bun:test'
import {
  adminCreateUserRequestSchema,
  adminUpdateUserRequestSchema,
  createJobRequestSchema,
  createProjectRequestSchema,
  errorResponseSchema,
  finishJobRequestSchema,
  handleSchema,
  ingestLogsRequestSchema,
  ingestMetricsRequestSchema,
  jobStatusSchema,
  limitSchema,
  listJobsQuerySchema,
  listLogsQuerySchema,
  listMediaQuerySchema,
  listMetricsQuerySchema,
  logStreamSchema,
  mediaKindSchema,
  pageSchema,
  paginationQuerySchema,
  roleSchema,
  serialIdSchema,
  setupRequestSchema,
  updateProfileRequestSchema,
  uploadMediaFieldsSchema,
  userSchema,
  visibilitySchema,
} from '../../src/shared/schemas'
import {
  ERROR_CODES,
  JOB_STATUSES,
  LOG_STREAMS,
  MEDIA_KINDS,
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  ROLES,
  VISIBILITIES,
} from '../../src/shared/types'

interface Parses {
  safeParse: (input: unknown) => { success: boolean }
}

const accepts = (schema: Parses, input: unknown): boolean => schema.safeParse(input).success

describe('pagination (SPEC §0.4)', () => {
  test('limit defaults to 20 and coerces query strings', () => {
    expect(limitSchema.safeParse(undefined)).toEqual({
      success: true,
      data: 20,
    })
    expect(PAGINATION_DEFAULT_LIMIT).toBe(20)
    expect(limitSchema.safeParse('7')).toEqual({ success: true, data: 7 })
  })

  test('limit accepts 1..100 and rejects everything outside or non-integer', () => {
    expect(PAGINATION_MAX_LIMIT).toBe(100)
    expect(accepts(limitSchema, '1')).toBe(true)
    expect(accepts(limitSchema, '100')).toBe(true)
    for (const bad of ['0', '101', '1.5', '-1', 'x', '']) {
      expect(accepts(limitSchema, bad)).toBe(false)
    }
  })

  test('cursor is optional but may not be empty; extra keys are ignored', () => {
    expect(paginationQuerySchema.safeParse({})).toEqual({
      success: true,
      data: { limit: 20 },
    })
    expect(
      paginationQuerySchema.safeParse({
        limit: '5',
        cursor: 'abc',
        other: 'x',
      }),
    ).toEqual({
      success: true,
      data: { limit: 5, cursor: 'abc' },
    })
    expect(accepts(paginationQuerySchema, { cursor: '' })).toBe(false)
  })

  test('pageSchema wraps an item schema and requires next_cursor to be a string or null', () => {
    const schema = pageSchema(jobStatusSchema)
    expect(accepts(schema, { items: ['running'], next_cursor: null })).toBe(true)
    expect(accepts(schema, { items: [], next_cursor: 'abc' })).toBe(true)
    expect(accepts(schema, { items: ['bogus'], next_cursor: null })).toBe(false)
    expect(accepts(schema, { items: [] })).toBe(false)
    expect(accepts(schema, { items: [], next_cursor: '' })).toBe(false)
  })

  test('the per-endpoint list queries inherit limit and cursor', () => {
    expect(accepts(listJobsQuerySchema, { status: 'failed' })).toBe(true)
    expect(accepts(listJobsQuerySchema, { status: 'bogus' })).toBe(false)
    expect(listMetricsQuerySchema.safeParse({ key: 'loss', since_step: '3' })).toEqual({
      success: true,
      data: { limit: 20, key: 'loss', since_step: 3 },
    })
    expect(accepts(listMetricsQuerySchema, { since_step: '1.5' })).toBe(false)
    expect(accepts(listMediaQuerySchema, { kind: 'audio' })).toBe(true)
    expect(accepts(listMediaQuerySchema, { kind: 'video' })).toBe(false)
    for (const schema of [listJobsQuerySchema, listMetricsQuerySchema, listMediaQuerySchema]) {
      expect(accepts(schema, { limit: '101' })).toBe(false)
    }
  })

  test('logs use before/after over the serial id with the shared limit', () => {
    expect(listLogsQuerySchema.safeParse({})).toEqual({
      success: true,
      data: { limit: 20 },
    })
    expect(accepts(listLogsQuerySchema, { before: '17', limit: '100' })).toBe(true)
    expect(accepts(listLogsQuerySchema, { after: '' })).toBe(false)
    expect(accepts(listLogsQuerySchema, { limit: '0' })).toBe(false)
  })
})

describe('enumerations (SPEC §1)', () => {
  test('each enum accepts exactly its table', () => {
    const pairs: Array<[Parses, readonly string[]]> = [
      [roleSchema, ROLES],
      [visibilitySchema, VISIBILITIES],
      [jobStatusSchema, JOB_STATUSES],
      [mediaKindSchema, MEDIA_KINDS],
      [logStreamSchema, LOG_STREAMS],
    ]
    for (const [schema, values] of pairs) {
      for (const value of values) {
        expect(accepts(schema, value)).toBe(true)
      }
      expect(accepts(schema, 'bogus')).toBe(false)
      expect(accepts(schema, '')).toBe(false)
    }
  })

  test('finish only accepts finished or failed', () => {
    expect(accepts(finishJobRequestSchema, { status: 'finished' })).toBe(true)
    expect(accepts(finishJobRequestSchema, { status: 'failed' })).toBe(true)
    expect(accepts(finishJobRequestSchema, { status: 'running' })).toBe(false)
    expect(accepts(finishJobRequestSchema, {})).toBe(false)
  })

  test('error responses carry a known code and a message', () => {
    for (const code of ERROR_CODES) {
      expect(accepts(errorResponseSchema, { error: { code, message: 'm' } })).toBe(true)
    }
    expect(accepts(errorResponseSchema, { error: { code: 'teapot', message: 'm' } })).toBe(false)
    expect(
      accepts(errorResponseSchema, {
        error: { code: 'not_found', message: '' },
      }),
    ).toBe(false)
  })
})

describe('handle (SPEC §5)', () => {
  test('is 3..32 ASCII letters, digits, - or _', () => {
    for (const ok of ['abc', 'a-b_c', 'A1_', 'x'.repeat(32), '123']) {
      expect(accepts(handleSchema, ok)).toBe(true)
    }
    for (const bad of ['', 'A1', 'x'.repeat(33), 'with space', 'ünïcode', 'a.b', 'a/b']) {
      expect(accepts(handleSchema, bad)).toBe(false)
    }
  })

  test('is shared by setup, admin create and profile update', () => {
    const base = { init_admin_key: 'k', display_name: 'D' }
    expect(accepts(setupRequestSchema, { ...base, handle: 'ok-handle' })).toBe(true)
    expect(accepts(setupRequestSchema, { ...base, handle: 'a' })).toBe(false)
    expect(
      accepts(setupRequestSchema, {
        ...base,
        init_admin_key: '',
        handle: 'ok',
      }),
    ).toBe(false)

    const create = {
      cf_access_email: 'a@example.com',
      display_name: 'D',
      role: 'user',
    }
    expect(accepts(adminCreateUserRequestSchema, { ...create, handle: 'ok-handle' })).toBe(true)
    expect(accepts(adminCreateUserRequestSchema, { ...create, handle: '!!' })).toBe(false)
    expect(
      accepts(adminCreateUserRequestSchema, {
        ...create,
        handle: 'ok-handle',
        cf_access_email: 'not-an-email',
      }),
    ).toBe(false)
    expect(accepts(adminUpdateUserRequestSchema, {})).toBe(true)
    expect(accepts(adminUpdateUserRequestSchema, { role: 'owner' })).toBe(false)

    expect(accepts(updateProfileRequestSchema, {})).toBe(true)
    expect(accepts(updateProfileRequestSchema, { handle: 'ok-handle' })).toBe(true)
    expect(accepts(updateProfileRequestSchema, { handle: '!!' })).toBe(false)
    expect(accepts(updateProfileRequestSchema, { display_name: '' })).toBe(false)
  })
})

describe('request bodies (SPEC §6-§10)', () => {
  test('create project defaults visibility to private', () => {
    expect(createProjectRequestSchema.safeParse({ name: 'p' })).toEqual({
      success: true,
      data: { name: 'p', visibility: 'private' },
    })
    expect(accepts(createProjectRequestSchema, { name: '' })).toBe(false)
    expect(accepts(createProjectRequestSchema, { name: 'p', visibility: 'hidden' })).toBe(false)
  })

  test('create job leaves name/config/id absent when omitted and rejects an empty name', () => {
    expect(createJobRequestSchema.safeParse({})).toEqual({
      success: true,
      data: {},
    })
    expect(accepts(createJobRequestSchema, { name: '' })).toBe(false)
    expect(accepts(createJobRequestSchema, { config: [] })).toBe(false)
    expect(
      accepts(createJobRequestSchema, {
        id: '00000000-0000-4000-8000-000000000000',
      }),
    ).toBe(true)
    expect(accepts(createJobRequestSchema, { id: 'not-a-uuid' })).toBe(false)
  })

  test('metrics ingest requires the array and validates each item', () => {
    expect(accepts(ingestMetricsRequestSchema, {})).toBe(false)
    expect(accepts(ingestMetricsRequestSchema, { metrics: [] })).toBe(true)
    expect(
      accepts(ingestMetricsRequestSchema, {
        metrics: [
          {
            step: 1,
            key: 'loss',
            value: 0.5,
            logged_at: '2026-09-24T00:00:00.000Z',
          },
        ],
      }),
    ).toBe(true)
    expect(
      accepts(ingestMetricsRequestSchema, {
        metrics: [{ step: 1.5, key: 'k', value: 0 }],
      }),
    ).toBe(false)
    expect(
      accepts(ingestMetricsRequestSchema, {
        metrics: [{ step: 1, key: '', value: 0 }],
      }),
    ).toBe(false)
    expect(
      accepts(ingestMetricsRequestSchema, {
        metrics: [{ step: 1, key: 'k', value: 0, logged_at: 'not a date' }],
      }),
    ).toBe(false)
  })

  test('logs ingest defaults a missing array to [] and validates each item', () => {
    expect(ingestLogsRequestSchema.safeParse({})).toEqual({
      success: true,
      data: { logs: [] },
    })
    expect(
      accepts(ingestLogsRequestSchema, {
        logs: [{ stream: 'stdout', message: 'x' }],
      }),
    ).toBe(true)
    expect(
      accepts(ingestLogsRequestSchema, {
        logs: [{ stream: 'bogus', message: 'x' }],
      }),
    ).toBe(false)
    expect(
      accepts(ingestLogsRequestSchema, {
        logs: [{ stream: 'stdout', message: '' }],
      }),
    ).toBe(false)
    expect(
      accepts(ingestLogsRequestSchema, {
        logs: [{ stream: 'stdout', message: 'x', logged_at: '2026-09-24' }],
      }),
    ).toBe(false)
  })

  test('media upload fields coerce step from the multipart string', () => {
    expect(
      uploadMediaFieldsSchema.safeParse({
        kind: 'image',
        step: '3',
        label: 'l',
      }),
    ).toEqual({
      success: true,
      data: { kind: 'image', step: 3, label: 'l' },
    })
    expect(
      accepts(uploadMediaFieldsSchema, {
        kind: 'image',
        step: '3.5',
        label: 'l',
      }),
    ).toBe(false)
    expect(
      accepts(uploadMediaFieldsSchema, {
        kind: 'image',
        step: '3',
        label: null,
      }),
    ).toBe(false)
  })
})

describe('response shapes (SPEC §1)', () => {
  test('serial ids are positive decimal strings', () => {
    for (const ok of ['1', '42', '9007199254740991']) {
      expect(accepts(serialIdSchema, ok)).toBe(true)
    }
    for (const bad of ['0', '-3', '01', 'abc', '1.2', '', '12345678901234567']) {
      expect(accepts(serialIdSchema, bad)).toBe(false)
    }
  })

  test('user requires a UUID id, an ISO timestamp and a nullable avatar_url', () => {
    const user = {
      id: '00000000-0000-4000-8000-000000000000',
      handle: 'alice',
      display_name: 'Alice',
      avatar_url: null,
      role: 'user',
      created_at: '2026-09-24T12:00:00.000Z',
    }
    expect(accepts(userSchema, user)).toBe(true)
    expect(accepts(userSchema, { ...user, avatar_url: '/api/users/alice/avatar' })).toBe(true)
    expect(accepts(userSchema, { ...user, id: 'not-a-uuid' })).toBe(false)
    expect(accepts(userSchema, { ...user, created_at: '2026-09-24' })).toBe(false)
    expect(accepts(userSchema, { ...user, avatar_url: undefined })).toBe(false)
  })
})
