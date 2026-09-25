import { Navigate, Outlet, useLocation } from '@tanstack/react-router'
import { Suspense } from 'react'
import { useCurrentUser } from '../../hooks/use-current-user'
import { useSetupStatus } from '../../hooks/use-setup-status'
import { LoadingRows } from '../common/loading-rows'
import { AppHeader } from './app-header'

const SETUP_PATH = '/setup'

/**
 * Shell for every route: the ruled header, then the page (which owns its
 * width). Also the setup gate (docs/SPEC.md §2): until `GET /api/setup`
 * reports a registered user, every page but /setup itself redirects there.
 */
export default function AppLayout() {
  const { user, loading } = useCurrentUser()
  const pathname = useLocation({ select: (location) => location.pathname })
  const setup = useSetupStatus()

  if (!setup.loading && setup.initialized === false && pathname !== SETUP_PATH) {
    return <Navigate to={SETUP_PATH} replace />
  }

  return (
    <div className="min-h-dvh">
      <AppHeader user={user} loading={loading} />
      <main>
        <Suspense fallback={<LoadingRows />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
