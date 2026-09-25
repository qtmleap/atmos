// POST /api/setup, in the two states the mocks draw:
//   - designs/pages/setup.html          fresh install, registration succeeds
//   - designs/pages/setup-closed.html   scenario `closed` (/setup?scenario=closed):
//                                       403 already_initialized
// Neither stores anything.
import { HANDLE_PATTERN, type SetupRequest, type SetupResponse } from '../../src/shared/types'
import { ME } from './me'
import { apiError, type FixtureHandler, json } from './respond'

export const SETUP_CLOSED_SCENARIO = 'closed'

/** The fixture's INIT_ADMIN_KEY; any other key is refused like the real one. */
export const FIXTURE_INIT_ADMIN_KEY = 'fixture-init-admin-key'

const isSetupRequest = (value: unknown): value is SetupRequest =>
  typeof value === 'object' &&
  value !== null &&
  'init_admin_key' in value &&
  typeof value.init_admin_key === 'string' &&
  value.init_admin_key !== '' &&
  'handle' in value &&
  typeof value.handle === 'string' &&
  HANDLE_PATTERN.test(value.handle) &&
  'display_name' in value &&
  typeof value.display_name === 'string' &&
  value.display_name !== ''

export const postSetup: FixtureHandler = async ({ scenario, json: body }) => {
  if (scenario === SETUP_CLOSED_SCENARIO) {
    return apiError(403, 'already_initialized', 'atmos already has a registered user')
  }
  const request = await body()
  if (!isSetupRequest(request)) {
    return apiError(400, 'validation_error', 'init_admin_key, handle and display_name are required')
  }
  if (request.init_admin_key !== FIXTURE_INIT_ADMIN_KEY) {
    return apiError(401, 'invalid_init_key', 'init_admin_key does not match')
  }
  const response: SetupResponse = {
    user: { ...ME, handle: request.handle, display_name: request.display_name },
  }
  return json(response)
}
