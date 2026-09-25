import { describe, expect, test } from 'bun:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import {
  ACCESS_JWT_HEADER,
  accessCertsUrl,
  assertCanViewProject,
  canViewProject,
  canWriteProject,
  generateAccessToken,
  hashAccessToken,
  isAdmin,
  localJwks,
  readBearerToken,
  requireAdmin,
  verifyAccessJwt,
} from '../../src/api/lib/auth'
import { ApiError } from '../../src/api/lib/errors'
import { now } from '../../src/api/lib/ids'
import type { UserRow } from '../../src/db/schema'
import { createFakeAccess, TEST_ACCESS_AUD, TEST_TEAM_DOMAIN } from '../helpers/access'

const config = { teamDomain: TEST_TEAM_DOMAIN, aud: TEST_ACCESS_AUD }

const user = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: 'u1',
  handle: 'alice',
  displayName: 'Alice',
  avatarKey: null,
  cfAccessEmail: 'alice@example.com',
  role: 'user',
  createdAt: now(),
  ...overrides,
})

const statusOf = (run: () => unknown): number | null => {
  try {
    run()
    return null
  } catch (error) {
    return error instanceof ApiError ? error.status : -1
  }
}

describe('verifyAccessJwt', async () => {
  const access = await createFakeAccess()
  const jwks = localJwks(access.jwks)

  test('accepts a valid token and returns its email', async () => {
    const token = await access.sign({ email: 'alice@example.com' })
    const identity = await verifyAccessJwt(token, config, jwks)
    expect(identity === null ? null : identity.email).toBe('alice@example.com')
  })

  test('rejects a wrong audience', async () => {
    const token = await access.sign({ email: 'a@example.com', aud: 'other-app' })
    expect(await verifyAccessJwt(token, config, jwks)).toBeNull()
  })

  test('rejects a wrong issuer', async () => {
    const token = await access.sign({ email: 'a@example.com', iss: 'https://evil.example.com' })
    expect(await verifyAccessJwt(token, config, jwks)).toBeNull()
  })

  test('rejects an expired token', async () => {
    const token = await access.sign({ email: 'a@example.com', expiresIn: -60 })
    expect(await verifyAccessJwt(token, config, jwks)).toBeNull()
  })

  test('rejects an algorithm other than RS256, even when the JWKS has its key', async () => {
    const rs384 = await generateKeyPair('RS384', { extractable: true })
    const rs384Jwks = localJwks({
      keys: [{ ...(await exportJWK(rs384.publicKey)), kid: 'rs384', alg: 'RS384' }],
    })
    const token = await new SignJWT({ email: 'a@example.com' })
      .setProtectedHeader({ alg: 'RS384', kid: 'rs384' })
      .setIssuer(`https://${TEST_TEAM_DOMAIN}`)
      .setAudience(TEST_ACCESS_AUD)
      .setExpirationTime('5m')
      .sign(rs384.privateKey)
    expect(await verifyAccessJwt(token, config, rs384Jwks)).toBeNull()
  })

  test('rejects a token without an email (service token)', async () => {
    const token = await access.sign({})
    expect(await verifyAccessJwt(token, config, jwks)).toBeNull()
  })

  test('rejects a token signed by another key', async () => {
    const other = await generateKeyPair('RS256')
    const token = await new SignJWT({ email: 'a@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'atmos-test-key' })
      .setIssuer(`https://${TEST_TEAM_DOMAIN}`)
      .setAudience(TEST_ACCESS_AUD)
      .setExpirationTime('5m')
      .sign(other.privateKey)
    expect(await verifyAccessJwt(token, config, jwks)).toBeNull()
  })

  test('rejects garbage', async () => {
    expect(await verifyAccessJwt('not.a.jwt', config, jwks)).toBeNull()
  })

  test('certs URL is derived from the team domain', () => {
    expect(accessCertsUrl('team.cloudflareaccess.com').toString()).toBe(
      'https://team.cloudflareaccess.com/cdn-cgi/access/certs',
    )
    expect(ACCESS_JWT_HEADER).toBe('Cf-Access-Jwt-Assertion')
  })
})

describe('access tokens', () => {
  test('generateAccessToken yields 32 random bytes in base64url', () => {
    const token = generateAccessToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateAccessToken()).not.toBe(token)
  })

  test('hashAccessToken is SHA-256 hex', async () => {
    expect(await hashAccessToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  test('readBearerToken parses the Authorization header', () => {
    const req = (value?: string) =>
      new Request('http://x/', value === undefined ? {} : { headers: { Authorization: value } })
    expect(readBearerToken(req('Bearer abc_-1'))).toBe('abc_-1')
    expect(readBearerToken(req('bearer abc'))).toBe('abc')
    expect(readBearerToken(req())).toBeNull()
    expect(readBearerToken(req('Basic abc'))).toBeNull()
    expect(readBearerToken(req('Bearer '))).toBeNull()
    expect(readBearerToken(req('Bearer a b'))).toBeNull()
  })
})

describe('authorization', () => {
  const owner = user({ id: 'owner' })
  const other = user({ id: 'other' })
  const admin = user({ id: 'admin', role: 'admin' })
  const publicProject = { visibility: 'public' as const, ownerId: 'owner' }
  const internalProject = { visibility: 'internal' as const, ownerId: 'owner' }
  const privateProject = { visibility: 'private' as const, ownerId: 'owner' }

  test('public projects are visible to everyone', () => {
    expect(canViewProject(publicProject, null)).toBe(true)
    expect(canViewProject(publicProject, other)).toBe(true)
  })

  test('internal projects are visible to any signed-in registered user, not to anonymous viewers', () => {
    expect(canViewProject(internalProject, null)).toBe(false)
    expect(canViewProject(internalProject, other)).toBe(true)
    expect(canViewProject(internalProject, owner)).toBe(true)
  })

  test('private projects are visible to the owner and admins only', () => {
    expect(canViewProject(privateProject, owner)).toBe(true)
    expect(canViewProject(privateProject, other)).toBe(false)
    expect(canViewProject(privateProject, null)).toBe(false)
    expect(canViewProject(privateProject, admin)).toBe(true)
  })

  test('assertCanViewProject: 401 for anonymous, 403 for non-owner/non-admin', () => {
    expect(statusOf(() => assertCanViewProject(privateProject, null))).toBe(401)
    expect(statusOf(() => assertCanViewProject(privateProject, other))).toBe(403)
    expect(statusOf(() => assertCanViewProject(privateProject, owner))).toBeNull()
    expect(statusOf(() => assertCanViewProject(privateProject, admin))).toBeNull()
    expect(statusOf(() => assertCanViewProject(publicProject, null))).toBeNull()
    expect(statusOf(() => assertCanViewProject(internalProject, null))).toBe(401)
    expect(statusOf(() => assertCanViewProject(internalProject, other))).toBeNull()
  })

  test('only the owner writes', () => {
    expect(canWriteProject(publicProject, owner)).toBe(true)
    expect(canWriteProject(publicProject, other)).toBe(false)
  })

  test('admin checks', () => {
    expect(isAdmin(user({ role: 'admin' }))).toBe(true)
    expect(isAdmin(user())).toBe(false)
    expect(statusOf(() => requireAdmin(user()))).toBe(403)
    expect(statusOf(() => requireAdmin(user({ role: 'admin' })))).toBeNull()
  })
})
