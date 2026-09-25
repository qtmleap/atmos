import { Outlet } from '@tanstack/react-router'
import { Suspense } from 'react'
import { useCurrentUser } from '../../hooks/use-current-user'
import { LoadingRows } from '../common/loading-rows'
import { AppHeader } from './app-header'

/** Shell for every route: the ruled header, then the page (which owns its width). */
export default function AppLayout() {
  const { user, loading } = useCurrentUser()
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
