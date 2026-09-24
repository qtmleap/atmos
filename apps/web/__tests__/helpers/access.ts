// A fake Cloudflare Access issuer: an RSA key pair, its JWKS, and a signer.
import dayjs from 'dayjs'
import { exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose'

export const TEST_TEAM_DOMAIN = 'atmos-test.cloudflareaccess.com'
export const TEST_ACCESS_AUD = 'atmos-test-aud'
export const TEST_KID = 'atmos-test-key'

export interface FakeAccess {
  jwks: { keys: JWK[] }
  sign: (claims: SignOptions) => Promise<string>
}

export interface SignOptions {
  email?: string
  aud?: string
  iss?: string
  /** Seconds from now; negative for an already expired token. */
  expiresIn?: number
}

export const createFakeAccess = async (): Promise<FakeAccess> => {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })
  const publicJwk = await exportJWK(publicKey)
  const jwks = { keys: [{ ...publicJwk, kid: TEST_KID, alg: 'RS256', use: 'sig' }] }
  const sign = async (options: SignOptions): Promise<string> => {
    const issuedAt = dayjs().unix()
    const expiresIn = options.expiresIn === undefined ? 300 : options.expiresIn
    const payload = options.email === undefined ? {} : { email: options.email }
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: TEST_KID })
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + expiresIn)
      .setIssuer(options.iss === undefined ? `https://${TEST_TEAM_DOMAIN}` : options.iss)
      .setAudience(options.aud === undefined ? TEST_ACCESS_AUD : options.aud)
      .setSubject('test-subject')
      .sign(privateKey)
  }
  return { jwks, sign }
}
