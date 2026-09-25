// Authentication and authorization helpers (docs/PLAN.md §3, docs/SPEC.md §0.2).
//
// Two independent credentials:
//   - Cloudflare Access JWT in `Cf-Access-Jwt-Assertion` (browsers).
//   - `Authorization: Bearer <token>` access token (the Python SDK).
//
// Functions named `require*` / `assert*` throw an ApiError (see errors.ts) so
// a route can call them inline; the rest return a value or null.
//
//   const viewer = await resolveViewer(c.env, c.req.raw)       // UserRow | null
//   assertCanViewProject(project, viewer)                      // 401 / 403
//   const user = await requireBearerUser(c.env, c.req.raw)     // 401
//   const admin = requireAdmin(await requireAccessUser(c.env, c.req.raw)) // 401 / 403
import { and, eq, isNull, or, type SQL } from 'drizzle-orm'
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  type JWTPayload,
  type JWTVerifyGetKey,
  jwtVerify,
} from 'jose'
import {
  accessTokens,
  createDb,
  type Db,
  type ProjectRow,
  projects,
  type UserRow,
  users,
} from '../../db/schema'
import { forbidden, unauthenticated } from './errors'
import { bytesToBase64Url } from './ids'

export const ACCESS_JWT_HEADER = 'Cf-Access-Jwt-Assertion'

// ---------------------------------------------------------------------------
// Cloudflare Access JWT
// ---------------------------------------------------------------------------

export interface AccessConfig {
  /** Team domain without scheme, e.g. "myteam.cloudflareaccess.com". */
  teamDomain: string
  /** Application Audience (AUD) tag. */
  aud: string
}

export interface AccessIdentity {
  email: string
  payload: JWTPayload
}

export type JwksResolver = JWTVerifyGetKey

export const accessConfigFromEnv = (env: CloudflareBindings): AccessConfig => ({
  teamDomain: env.ACCESS_TEAM_DOMAIN,
  aud: env.ACCESS_AUD,
})

export const accessCertsUrl = (teamDomain: string): URL =>
  new URL(`https://${teamDomain}/cdn-cgi/access/certs`)

/** How long fetched signing keys are reused before the JWKS is fetched again. */
export const JWKS_CACHE_MAX_AGE_MS = 10 * 60 * 1000

// One remote key set per team domain for the lifetime of the isolate. jose
// keeps the fetched keys for JWKS_CACHE_MAX_AGE_MS and refetches early when a
// token names a key id it has not seen (Access key rotation).
const remoteJwksCache = new Map<string, JwksResolver>()

export const getAccessJwks = (teamDomain: string): JwksResolver => {
  const cached = remoteJwksCache.get(teamDomain)
  if (cached !== undefined) {
    return cached
  }
  const jwks = createRemoteJWKSet(accessCertsUrl(teamDomain), {
    cacheMaxAge: JWKS_CACHE_MAX_AGE_MS,
  })
  remoteJwksCache.set(teamDomain, jwks)
  return jwks
}

/** Builds a resolver from an in-memory JWKS document (tests, fixed keys). */
export const localJwks = (jwks: Parameters<typeof createLocalJWKSet>[0]): JwksResolver =>
  createLocalJWKSet(jwks)

/**
 * Verifies an Access JWT: RS256 signature against the team JWKS, `aud`
 * containing the application AUD, `iss` equal to the team domain, and `exp`
 * not passed. Returns null for any invalid token, and for tokens without an
 * email (Access service tokens).
 */
export const verifyAccessJwt = async (
  token: string,
  config: AccessConfig,
  jwks: JwksResolver = getAccessJwks(config.teamDomain),
): Promise<AccessIdentity | null> => {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      audience: config.aud,
      issuer: `https://${config.teamDomain}`,
    })
    const email = payload.email
    if (typeof email !== 'string' || email.length === 0) {
      return null
    }
    return { email, payload }
  } catch {
    return null
  }
}

/**
 * Access identity of the request, or null when the header is absent or does
 * not verify. Resources that are public treat both cases as anonymous.
 */
export const readAccessIdentity = async (
  env: CloudflareBindings,
  request: Request,
  jwks?: JwksResolver,
): Promise<AccessIdentity | null> => {
  const token = request.headers.get(ACCESS_JWT_HEADER)
  if (token === null || token.length === 0) {
    return null
  }
  return verifyAccessJwt(token, accessConfigFromEnv(env), jwks)
}

/** Like readAccessIdentity, but throws 401 `unauthenticated` instead of returning null. */
export const requireAccessIdentity = async (
  env: CloudflareBindings,
  request: Request,
  jwks?: JwksResolver,
): Promise<AccessIdentity> => {
  const identity = await readAccessIdentity(env, request, jwks)
  if (identity === null) {
    throw unauthenticated('Cloudflare Access login required')
  }
  return identity
}

export const findUserByEmail = async (db: Db, email: string): Promise<UserRow | null> => {
  const row = await db.query.users.findFirst({ where: eq(users.cfAccessEmail, email) })
  return row === undefined ? null : row
}

/**
 * The registered user behind the request's Access identity, or null when the
 * request is anonymous, the JWT does not verify, or the email has no `users` row.
 * This is the "viewer" of visibility checks.
 */
export const resolveViewer = async (
  env: CloudflareBindings,
  request: Request,
  jwks?: JwksResolver,
): Promise<UserRow | null> => {
  const identity = await readAccessIdentity(env, request, jwks)
  if (identity === null) {
    return null
  }
  return findUserByEmail(createDb(env.DB), identity.email)
}

/**
 * The registered user behind the request's Access identity. Throws 401
 * `unauthenticated` when there is no valid identity or when the email is not
 * registered (docs/SPEC.md §4 `GET /api/me` lists only 401).
 */
export const requireAccessUser = async (
  env: CloudflareBindings,
  request: Request,
  jwks?: JwksResolver,
): Promise<UserRow> => {
  const identity = await requireAccessIdentity(env, request, jwks)
  const user = await findUserByEmail(createDb(env.DB), identity.email)
  if (user === null) {
    throw unauthenticated('this Cloudflare Access identity is not registered as an atmos user')
  }
  return user
}

// ---------------------------------------------------------------------------
// Bearer access tokens
// ---------------------------------------------------------------------------

/** Random bytes per token (256 bits). */
export const ACCESS_TOKEN_BYTES = 32

/** A new plaintext access token: 32 random bytes, base64url (43 characters). */
export const generateAccessToken = (): string =>
  bytesToBase64Url(crypto.getRandomValues(new Uint8Array(ACCESS_TOKEN_BYTES)))

/** SHA-256 of the token as lowercase hex; this is what `access_tokens.token_hash` stores. */
export const hashAccessToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Token from `Authorization: Bearer <token>`, or null when absent or malformed. */
export const readBearerToken = (request: Request): string | null => {
  const header = request.headers.get('Authorization')
  if (header === null) {
    return null
  }
  const match = /^Bearer[ ]+([^\s]+)[ ]*$/i.exec(header)
  const token = match === null ? undefined : match[1]
  return token === undefined ? null : token
}

/** The owner of a non-revoked token with this plaintext value, or null. */
export const findUserByAccessToken = async (db: Db, token: string): Promise<UserRow | null> => {
  const tokenHash = await hashAccessToken(token)
  const rows = await db
    .select({ user: users })
    .from(accessTokens)
    .innerJoin(users, eq(accessTokens.userId, users.id))
    .where(and(eq(accessTokens.tokenHash, tokenHash), isNull(accessTokens.revokedAt)))
    .limit(1)
  const row = rows[0]
  return row === undefined ? null : row.user
}

/** The user owning the request's Bearer token. Throws 401 `unauthenticated` otherwise. */
export const requireBearerUser = async (
  env: CloudflareBindings,
  request: Request,
): Promise<UserRow> => {
  const token = readBearerToken(request)
  if (token === null) {
    throw unauthenticated('Bearer access token required')
  }
  const user = await findUserByAccessToken(createDb(env.DB), token)
  if (user === null) {
    throw unauthenticated('invalid or revoked access token')
  }
  return user
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

export const isAdmin = (user: UserRow): boolean => user.role === 'admin'

/** Returns the user when it is an admin, otherwise throws 403 `forbidden`. */
export const requireAdmin = (user: UserRow): UserRow => {
  if (!isAdmin(user)) {
    throw forbidden('admin role required')
  }
  return user
}

type ProjectAccess = Pick<ProjectRow, 'visibility' | 'ownerId'>

/**
 * Visibility rule (docs/SPEC.md §1 Project):
 *   - `public`: everyone, including anonymous viewers.
 *   - `internal`: any signed-in registered user.
 *   - `private`: the owner and admins only.
 * Admins can always view a project regardless of `visibility`.
 */
export const canViewProject = (project: ProjectAccess, viewer: UserRow | null): boolean => {
  if (project.visibility === 'public') {
    return true
  }
  if (viewer === null) {
    return false
  }
  if (viewer.id === project.ownerId || isAdmin(viewer)) {
    return true
  }
  return project.visibility === 'internal'
}

/**
 * Throws unless `viewer` may see `project`: 401 `unauthenticated` for an
 * anonymous viewer of a non-public project, 403 `forbidden` for a signed-in
 * viewer without permission (non-owner/non-admin on `private`). List
 * endpoints should filter with projectVisibilityCondition instead.
 */
export const assertCanViewProject = (project: ProjectAccess, viewer: UserRow | null): void => {
  if (canViewProject(project, viewer)) {
    return
  }
  if (viewer === null) {
    throw unauthenticated('this project is private; Cloudflare Access login required')
  }
  throw forbidden('this project is private')
}

/**
 * The `WHERE` condition every project list endpoint filters with, so the
 * rule above is expressed once: anonymous viewers see `public` only,
 * signed-in registered users additionally see `internal` and their own
 * projects, and admins see everything (`undefined`, i.e. no filter).
 */
export const projectVisibilityCondition = (viewer: UserRow | null): SQL | undefined => {
  if (viewer === null) {
    return eq(projects.visibility, 'public')
  }
  if (isAdmin(viewer)) {
    return undefined
  }
  return or(
    eq(projects.visibility, 'public'),
    eq(projects.visibility, 'internal'),
    eq(projects.ownerId, viewer.id),
  )
}

/**
 * Only the owner writes to a project (jobs, metrics, media, logs through the
 * Bearer token). docs/SPEC.md §7 answers a missing write permission with
 * 404 `not_found`, so the caller decides the error.
 */
export const canWriteProject = (project: Pick<ProjectRow, 'ownerId'>, user: UserRow): boolean =>
  user.id === project.ownerId

/**
 * The owner or an admin may edit or delete a project (and its jobs): the
 * PATCH/DELETE endpoints of docs/SPEC.md §6/§7, reachable from the web UI by
 * an admin acting on someone else's project, not only through the Bearer
 * token the SDK uses. Unlike `canWriteProject`, a missing permission here is
 * reported as 403 `forbidden` when the project is otherwise visible (404
 * only when it is not, or does not exist).
 */
export const canManageProject = (project: Pick<ProjectRow, 'ownerId'>, user: UserRow): boolean =>
  user.id === project.ownerId || isAdmin(user)
