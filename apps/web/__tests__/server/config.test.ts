// Tests for src/server/config.ts: env parsing, defaults, and the two ways to
// describe an AuthConfig (Cloudflare Access shortcut vs. generic OIDC).
import { describe, expect, test } from 'bun:test'
import { loadServerConfig } from '../../src/server/config'

const BASE_ENV = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/atmos',
  ACCESS_TEAM_DOMAIN: 'myteam.cloudflareaccess.com',
  ACCESS_AUD: 'some-aud',
}

describe('loadServerConfig', () => {
  test('applies defaults when only the required vars are set', () => {
    const config = loadServerConfig(BASE_ENV)
    expect(config.port).toBe(8787)
    expect(config.databaseUrl).toBe(BASE_ENV.DATABASE_URL)
    expect(config.dataDir).toBe('/data')
    expect(config.staticDir).toBe('dist/client')
    expect(config.initAdminKey).toBe('')
  })

  test('reads PORT, DATA_DIR, STATIC_DIR, INIT_ADMIN_KEY overrides', () => {
    const config = loadServerConfig({
      ...BASE_ENV,
      PORT: '3000',
      DATA_DIR: '/srv/data',
      STATIC_DIR: '/srv/static',
      INIT_ADMIN_KEY: 'super-secret',
    })
    expect(config.port).toBe(3000)
    expect(config.dataDir).toBe('/srv/data')
    expect(config.staticDir).toBe('/srv/static')
    expect(config.initAdminKey).toBe('super-secret')
  })

  test('throws when DATABASE_URL is missing', () => {
    expect(() => loadServerConfig({ ACCESS_TEAM_DOMAIN: 'x', ACCESS_AUD: 'y' })).toThrow(
      /invalid server configuration/,
    )
  })

  test('ACCESS_TEAM_DOMAIN + ACCESS_AUD derive a Cloudflare Access AuthConfig', () => {
    const config = loadServerConfig(BASE_ENV)
    expect(config.auth).toEqual({
      issuer: 'https://myteam.cloudflareaccess.com',
      audience: 'some-aud',
      jwksUrl: new URL('https://myteam.cloudflareaccess.com/cdn-cgi/access/certs'),
      header: 'Cf-Access-Jwt-Assertion',
      cookie: 'CF_Authorization',
      emailClaim: 'email',
      algorithms: ['RS256'],
      localEmail: undefined,
    })
  })

  test('never sets localEmail, unlike the dev server', () => {
    const config = loadServerConfig(BASE_ENV)
    expect(config.auth.localEmail).toBeUndefined()
  })

  test('AUTH_ISSUER + AUTH_AUDIENCE + AUTH_JWKS_URL describe a generic OIDC provider', () => {
    const config = loadServerConfig({
      DATABASE_URL: BASE_ENV.DATABASE_URL,
      AUTH_ISSUER: 'https://issuer.example.com',
      AUTH_AUDIENCE: 'atmos',
      AUTH_JWKS_URL: 'https://issuer.example.com/jwks.json',
    })
    expect(config.auth).toEqual({
      issuer: 'https://issuer.example.com',
      audience: 'atmos',
      jwksUrl: new URL('https://issuer.example.com/jwks.json'),
      header: null,
      cookie: null,
      emailClaim: 'email',
      algorithms: ['RS256'],
    })
  })

  test('AUTH_JWT_HEADER / AUTH_JWT_COOKIE / AUTH_EMAIL_CLAIM / AUTH_ALGORITHMS overrides', () => {
    const config = loadServerConfig({
      DATABASE_URL: BASE_ENV.DATABASE_URL,
      AUTH_ISSUER: 'https://issuer.example.com',
      AUTH_AUDIENCE: 'atmos',
      AUTH_JWKS_URL: 'https://issuer.example.com/jwks.json',
      AUTH_JWT_HEADER: 'X-Auth-Jwt',
      AUTH_JWT_COOKIE: 'auth_jwt',
      AUTH_EMAIL_CLAIM: 'preferred_username',
      AUTH_ALGORITHMS: ' RS256 , ES256 ',
    })
    expect(config.auth.header).toBe('X-Auth-Jwt')
    expect(config.auth.cookie).toBe('auth_jwt')
    expect(config.auth.emailClaim).toBe('preferred_username')
    expect(config.auth.algorithms).toEqual(['RS256', 'ES256'])
  })

  test('throws when neither auth source is fully specified', () => {
    expect(() =>
      loadServerConfig({
        DATABASE_URL: BASE_ENV.DATABASE_URL,
        AUTH_ISSUER: 'https://issuer.example.com',
      }),
    ).toThrow(/ACCESS_TEAM_DOMAIN \+ ACCESS_AUD, or AUTH_ISSUER \+ AUTH_AUDIENCE \+ AUTH_JWKS_URL/)
  })

  test('throws when nothing describes an auth source at all', () => {
    expect(() => loadServerConfig({ DATABASE_URL: BASE_ENV.DATABASE_URL })).toThrow()
  })
})
