// The signed-in user's own settings: PATCH /api/settings/profile and
// PUT /api/settings/avatar (designs/pages/settings-profile.html), GET/POST/
// DELETE /api/settings/tokens (designs/pages/settings-tokens.html,
// designs/pages/settings-tokens-active.html).
//
// Nothing is stored: a save answers with the edited user but GET /api/me keeps
// returning the fixture, so a reload shows the mock again. GET tokens answers
// with ISSUED_TOKEN (minus the plaintext) as the "active" token, matching
// settings-tokens-active.html. Scenarios:
//   - `?scenario=none` (settings-tokens-none.html): no token yet.
//   - `?scenario=issued` (settings-tokens.html) and `?scenario=revoked`
//     (settings-tokens-revoked.html): GET answers as the default; the page then
//     replays POST or DELETE once (src/app/lib/token-search.ts), and those
//     answer with ISSUED_TOKEN and 204 as always.
import {
  type AccessTokenCreated,
  type AccessTokenStatus,
  HANDLE_PATTERN,
  type UpdateAvatarResponse,
  type UpdateProfileRequest,
  type UserWithEmail,
} from '../../src/shared/types'
import { ME } from './me'
import { apiError, type FixtureHandler, json, noContent } from './respond'

/** The token and time settings-tokens.html shows right after issuing. */
export const ISSUED_TOKEN: AccessTokenCreated = {
  id: 'tok_misaki_t_1',
  issued_at: '2026-09-24T09:42:00Z',
  revoked_at: null,
  hint: 'atmos_...w52G',
  token: 'atmos_v1JYP8vUPD3rjF6Pfo89T0gEk3MY39122Icxagew52G',
}

const isUpdateProfileRequest = (value: unknown): value is UpdateProfileRequest =>
  typeof value === 'object' &&
  value !== null &&
  (!('handle' in value) ||
    (typeof value.handle === 'string' && HANDLE_PATTERN.test(value.handle))) &&
  (!('display_name' in value) ||
    (typeof value.display_name === 'string' && value.display_name !== ''))

export const updateProfile: FixtureHandler = async ({ json: body }) => {
  const request = await body()
  if (!isUpdateProfileRequest(request)) {
    return apiError(400, 'validation_error', 'handle or display_name is invalid')
  }
  const updated: UserWithEmail = {
    ...ME,
    handle: request.handle === undefined ? ME.handle : request.handle,
    display_name: request.display_name === undefined ? ME.display_name : request.display_name,
  }
  return json(updated)
}

export const updateAvatar: FixtureHandler = () => {
  const response: UpdateAvatarResponse = { avatar_url: `/api/users/${ME.handle}/avatar` }
  return json(response)
}

/** `?scenario=none` shows the no-token state instead of ISSUED_TOKEN as active. */
export const TOKENS_NONE_SCENARIO = 'none'

export const getTokenStatus: FixtureHandler = ({ scenario }) => {
  if (scenario === TOKENS_NONE_SCENARIO) {
    const response: AccessTokenStatus = { active: null }
    return json(response)
  }
  const { token: _token, ...active } = ISSUED_TOKEN
  const response: AccessTokenStatus = { active }
  return json(response)
}

export const issueToken: FixtureHandler = () => json(ISSUED_TOKEN, 201)

export const revokeToken: FixtureHandler = () => noContent()
