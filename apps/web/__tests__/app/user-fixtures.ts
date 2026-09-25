// Wire objects for the user/settings/admin/setup screen tests, in the
// docs/SPEC.md §1/§2/§3 shapes. Kept separate from fixtures.ts (projects/jobs)
// since these screens are owned by a different slice of the app.
import type { AccessTokenCreated, SetupResponse, User, UserWithEmail } from '../../src/shared/types'

export const USER_ID = '00000000-0000-4000-8000-0000000000a1'
export const ADMIN_ID = '00000000-0000-4000-8000-0000000000a2'

export const user = (overrides: Partial<User> = {}): User => ({
  id: USER_ID,
  handle: 'alice',
  display_name: 'Alice',
  avatar_url: null,
  role: 'user',
  created_at: '2026-09-01T00:00:00.000Z',
  ...overrides,
})

export const userWithEmail = (overrides: Partial<UserWithEmail> = {}): UserWithEmail => ({
  ...user(overrides),
  cf_access_email: 'alice@example.com',
  ...overrides,
})

export const admin = (overrides: Partial<UserWithEmail> = {}): UserWithEmail =>
  userWithEmail({
    id: ADMIN_ID,
    handle: 'admin-taro',
    display_name: '管理者太郎',
    role: 'admin',
    cf_access_email: 'admin@example.com',
    ...overrides,
  })

export const accessTokenCreated = (
  overrides: Partial<AccessTokenCreated> = {},
): AccessTokenCreated => ({
  id: '00000000-0000-4000-8000-0000000000b1',
  token: 'atmos_sk_test_token_value',
  issued_at: '2026-09-24T00:00:00.000Z',
  revoked_at: null,
  ...overrides,
})

export const setupResponse = (overrides: Partial<SetupResponse> = {}): SetupResponse => ({
  user: userWithEmail({ role: 'admin' }),
  ...overrides,
})
