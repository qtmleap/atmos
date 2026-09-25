import { describe, expect, test } from 'bun:test'
import type { FixtureRequest, FixtureResponse } from '../../dev/fixtures/respond'
import { getTokenStatus, ISSUED_TOKEN } from '../../dev/fixtures/settings'

const request = (scenario: string | null): FixtureRequest => ({
  method: 'GET',
  url: new URL('/api/settings/tokens', 'http://localhost/'),
  params: {},
  scenario,
  pagePath: null,
  json: async () => undefined,
})

const body = async (response: FixtureResponse | Promise<FixtureResponse>) =>
  JSON.parse(String((await response).body))

const { token: _plaintext, ...ACTIVE } = ISSUED_TOKEN

describe('GET /api/settings/tokens fixture', () => {
  test('answers ISSUED_TOKEN without the plaintext by default', async () => {
    expect(await body(getTokenStatus(request(null)))).toEqual({ active: ACTIVE })
  })

  test('none has no active token', async () => {
    expect(await body(getTokenStatus(request('none')))).toEqual({ active: null })
  })

  test('issued and revoked start from the active token the page then reissues or revokes', async () => {
    expect(await body(getTokenStatus(request('issued')))).toEqual({ active: ACTIVE })
    expect(await body(getTokenStatus(request('revoked')))).toEqual({ active: ACTIVE })
  })
})
