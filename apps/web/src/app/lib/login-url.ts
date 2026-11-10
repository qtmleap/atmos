// The login entry of the web UI: `GET /api/me/login`, which Cloudflare Access
// protects like the other /api/me paths (docs/PLAN.md §3.1), so opening it
// signed out goes through Access's login, and the Worker then sends the
// visitor back to `redirect`. It has to be a full page load (a plain <a>):
// a client-side route change would never reach Access.

export const LOGIN_PATH = '/api/me/login'

/** Link that signs the visitor in and returns them to `returnTo` (path plus query). */
export const loginHref = (returnTo: string): string =>
  `${LOGIN_PATH}?redirect=${encodeURIComponent(returnTo)}`
