// Cloudflare Access's own logout: visiting /cdn-cgi/access/logout on the
// app's domain revokes the session and clears its authorization cookie
// (Cloudflare docs, "Log out as a user", cloudflare-one/access-controls/
// access-settings/session-management), but the endpoint has no documented
// return-destination parameter (unlike generateLoginURL's redirectURL, which
// is a Pages-Functions-plugin helper for a different login flow and does not
// apply here). So instead of a full navigation to it, this fetches it in the
// background — same-origin, so the browser still applies the cookie-clearing
// response — then moves the SPA to / and refetches the signed-in user,
// leaving the visitor on the home page instead of stranded on Access's own
// logout page.
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useCurrentUser } from './use-current-user'

export const ACCESS_LOGOUT_PATH = '/cdn-cgi/access/logout'

export function useLogout(): () => void {
  const navigate = useNavigate()
  const { refetch } = useCurrentUser()

  return useCallback(() => {
    fetch(ACCESS_LOGOUT_PATH, { credentials: 'include' })
      .catch(() => {
        // A failed logout request still gets the visitor back to /; the
        // Access session may outlive this page in that case.
      })
      .finally(() => {
        refetch()
      })
    void navigate({ to: '/' })
  }, [navigate, refetch])
}
