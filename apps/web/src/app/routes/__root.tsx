// Root of every route (docs/PLAN.md §6). The route files under this
// directory are the source of routeTree.gen.ts (@tanstack/router-plugin in
// vite.config.ts); pages live in ../pages and are imported by the route that
// mounts them, so the plugin's autoCodeSplitting loads each on demand.
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { IntlayerProvider } from 'react-intlayer'
import NotFound from '../components/layout/not-found'
import { TooltipProvider } from '../components/ui/tooltip'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <IntlayerProvider>
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
    </IntlayerProvider>
  )
}
