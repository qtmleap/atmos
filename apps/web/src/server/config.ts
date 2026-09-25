// Self-hosted server configuration: `process.env`, parsed once at startup
// (src/server/index.ts) into the pieces src/server/platform.ts assembles a
// Platform (src/api/platform/types.ts) from.
//
// Browsers are authenticated the same way as on Cloudflare (an OIDC JWT
// checked against an AuthConfig, src/api/lib/auth.ts), but the issuer is
// generic here instead of always being Cloudflare Access. Two ways to
// describe it:
//   - ACCESS_TEAM_DOMAIN + ACCESS_AUD: shortcut for a Cloudflare Access
//     application, turned into an AuthConfig by accessAuthConfig.
//   - AUTH_ISSUER + AUTH_AUDIENCE + AUTH_JWKS_URL (any OIDC provider), with
//     AUTH_JWT_HEADER / AUTH_JWT_COOKIE / AUTH_EMAIL_CLAIM / AUTH_ALGORITHMS
//     as optional overrides.
// Unlike `vite.config.ts` (LOCAL_ACCESS_EMAIL) the self-hosted server never
// sets AuthConfig.localEmail: every request must carry a verifiable JWT, dev
// or not.
import { z } from 'zod'
import { type AccessConfig, type AuthConfig, accessAuthConfig } from '../api/lib/auth'

const DEFAULT_PORT = 8787
const DEFAULT_DATA_DIR = '/data'
const DEFAULT_STATIC_DIR = 'dist/client'
const DEFAULT_EMAIL_CLAIM = 'email'
const DEFAULT_ALGORITHMS = 'RS256'

const optionalNonEmpty = z.string().nonempty().optional()

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  DATABASE_URL: z.url(),
  DATA_DIR: z.string().nonempty().default(DEFAULT_DATA_DIR),
  STATIC_DIR: z.string().nonempty().default(DEFAULT_STATIC_DIR),
  INIT_ADMIN_KEY: optionalNonEmpty,
  ACCESS_TEAM_DOMAIN: optionalNonEmpty,
  ACCESS_AUD: optionalNonEmpty,
  AUTH_ISSUER: z.url().optional(),
  AUTH_AUDIENCE: optionalNonEmpty,
  AUTH_JWKS_URL: z.url().optional(),
  AUTH_JWT_HEADER: optionalNonEmpty,
  AUTH_JWT_COOKIE: optionalNonEmpty,
  AUTH_EMAIL_CLAIM: z.string().nonempty().default(DEFAULT_EMAIL_CLAIM),
  AUTH_ALGORITHMS: z.string().nonempty().default(DEFAULT_ALGORITHMS),
})

export interface ServerConfig {
  port: number
  databaseUrl: string
  dataDir: string
  staticDir: string
  /** Compared with `init_admin_key` of POST /api/setup; empty when INIT_ADMIN_KEY is unset (nothing will match it). */
  initAdminKey: string
  auth: AuthConfig
}

const authConfigFrom = (env: z.output<typeof envSchema>): AuthConfig => {
  if (env.ACCESS_TEAM_DOMAIN !== undefined && env.ACCESS_AUD !== undefined) {
    const access: AccessConfig = { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD }
    return accessAuthConfig(access)
  }
  if (
    env.AUTH_ISSUER === undefined ||
    env.AUTH_AUDIENCE === undefined ||
    env.AUTH_JWKS_URL === undefined
  ) {
    throw new Error(
      'set ACCESS_TEAM_DOMAIN + ACCESS_AUD, or AUTH_ISSUER + AUTH_AUDIENCE + AUTH_JWKS_URL, to describe who signs browser JWTs',
    )
  }
  const algorithms = env.AUTH_ALGORITHMS.split(',')
    .map((algorithm) => algorithm.trim())
    .filter((algorithm) => algorithm.length > 0)
  return {
    issuer: env.AUTH_ISSUER,
    audience: env.AUTH_AUDIENCE,
    jwksUrl: new URL(env.AUTH_JWKS_URL),
    header: env.AUTH_JWT_HEADER === undefined ? null : env.AUTH_JWT_HEADER,
    cookie: env.AUTH_JWT_COOKIE === undefined ? null : env.AUTH_JWT_COOKIE,
    emailClaim: env.AUTH_EMAIL_CLAIM,
    algorithms,
  }
}

/** Parses `source` (`process.env` in production) into a ServerConfig; throws with every issue on one line when it does not validate. */
export const loadServerConfig = (
  source: Record<string, string | undefined> = process.env,
): ServerConfig => {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`invalid server configuration: ${issues}`)
  }
  const env = result.data
  return {
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    dataDir: env.DATA_DIR,
    staticDir: env.STATIC_DIR,
    initAdminKey: env.INIT_ADMIN_KEY === undefined ? '' : env.INIT_ADMIN_KEY,
    auth: authConfigFrom(env),
  }
}
