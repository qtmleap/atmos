// GET /api/me — the signed-in user every mock header shows: 田中 美咲 (avatar
// initial 田), an admin.
import type { UserWithEmail } from '../../src/shared/types'
import { apiError, type FixtureHandler, json } from './respond'

export const ME: UserWithEmail = {
  id: 'usr_misaki_t',
  handle: 'misaki_t',
  display_name: '田中 美咲',
  avatar_url: null,
  role: 'admin',
  created_at: '2026-08-01T09:00:00Z',
  cf_access_email: 'misaki.tanaka@example.com',
}

/**
 * designs/pages/setup.html is a fresh install: its header has no user menu, so
 * nobody is signed in yet. setup-closed.html (scenario `closed`) does show one.
 * Shared with setup.ts's GET /api/setup, which must agree with this: an
 * unauthenticated /setup page has to be an uninitialized one too, or the form
 * would find itself immediately `closed` (hooks/use-setup-form.ts).
 * Scenario `uninitialized` is a fresh install seen from any page, so nobody is
 * signed in there either.
 */
export const isFreshSetupPage = (pagePath: string | null, scenario: string | null): boolean =>
  (pagePath === '/setup' && scenario !== 'closed') || scenario === 'uninitialized'

/**
 * Scenario `signed-out`: a visitor without a Cloudflare Access session
 * (designs/pages/projects-signed-out.html, signin-required.html). Every
 * handler that filters by visibility asks this too.
 */
export const isSignedOut = (scenario: string | null): boolean => scenario === 'signed-out'

export const getMe: FixtureHandler = ({ pagePath, scenario }) =>
  isSignedOut(scenario)
    ? apiError(401, 'unauthenticated', 'not signed in (signed-out scenario)')
    : isFreshSetupPage(pagePath, scenario)
      ? apiError(401, 'unauthenticated', 'no user is registered yet (setup scenario)')
      : json(ME)
