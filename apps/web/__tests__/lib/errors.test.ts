import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import {
  ApiError,
  errorResponse,
  handleError,
  notFound,
  readJson,
  validate,
} from '../../src/api/lib/errors'
import { jsonOf } from '../helpers/http'

const bodySchema = z.object({ name: z.string().nonempty(), count: z.number().int() })

const app = new Hono()
app.onError(handleError)
app.get('/api-error', () => {
  throw notFound('job not found')
})
app.get('/http-exception', () => {
  throw new HTTPException(413, { message: 'too big' })
})
app.get('/crash', () => {
  throw new Error('secret detail')
})
app.post('/json', async (c) => c.json(await readJson(c.req.raw, bodySchema)))

describe('errorResponse', () => {
  test('returns the SPEC §0.3 shape', async () => {
    const res = errorResponse(409, 'conflict', 'handle taken')
    expect(res.status).toBe(409)
    expect(res.headers.get('Content-Type')).toStartWith('application/json')
    expect(await jsonOf(res)).toEqual({ error: { code: 'conflict', message: 'handle taken' } })
  })
})

describe('handleError', () => {
  test('keeps the status and code of ApiError', async () => {
    const res = await app.request('/api-error')
    expect(res.status).toBe(404)
    expect(await jsonOf(res)).toEqual({ error: { code: 'not_found', message: 'job not found' } })
  })

  test('maps HTTPException status to a code', async () => {
    const res = await app.request('/http-exception')
    expect(res.status).toBe(413)
    expect(await jsonOf(res)).toEqual({ error: { code: 'payload_too_large', message: 'too big' } })
  })

  test('hides unexpected errors behind internal_error', async () => {
    const original = console.error
    console.error = () => {}
    const res = await app.request('/crash')
    console.error = original
    expect(res.status).toBe(500)
    expect(await jsonOf(res)).toEqual({
      error: { code: 'internal_error', message: 'internal server error' },
    })
  })
})

describe('validate / readJson', () => {
  test('returns parsed data', () => {
    expect(validate(bodySchema, { name: 'a', count: 1 })).toEqual({ name: 'a', count: 1 })
  })

  test('throws a 400 validation_error listing the paths', () => {
    const run = () => validate(bodySchema, { name: '', count: 1.5 })
    expect(run).toThrow(ApiError)
    try {
      run()
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      if (error instanceof ApiError) {
        expect(error.status).toBe(400)
        expect(error.code).toBe('validation_error')
        expect(error.message).toContain('name:')
        expect(error.message).toContain('count:')
      }
    }
  })

  test('malformed JSON is a 400 validation_error', async () => {
    const res = await app.request('/json', { method: 'POST', body: '{nope' })
    expect(res.status).toBe(400)
    expect(await jsonOf(res)).toEqual({
      error: { code: 'validation_error', message: 'request body is not valid JSON' },
    })
  })

  test('valid JSON passes through', async () => {
    const res = await app.request('/json', {
      method: 'POST',
      body: JSON.stringify({ name: 'x', count: 2 }),
    })
    expect(res.status).toBe(200)
    expect(await jsonOf(res)).toEqual({ name: 'x', count: 2 })
  })
})
