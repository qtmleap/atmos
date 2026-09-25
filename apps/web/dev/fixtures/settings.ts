// The signed-in user's own settings: PATCH /api/settings/profile and
// PUT /api/settings/avatar (designs/pages/settings-profile.html), POST/DELETE
// /api/settings/tokens (designs/pages/settings-tokens.html).
//
// Nothing is stored: a save answers with the edited user but GET /api/me keeps
// returning the fixture, so a reload shows the mock again.
import {
  type AccessTokenCreated,
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
  token: 'atmos_mock_7f2a9c4e8b1d6f03a5c9e2b8d4f61072',
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

export const issueToken: FixtureHandler = () => json(ISSUED_TOKEN, 201)

export const revokeToken: FixtureHandler = () => noContent()
