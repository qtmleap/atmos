// The client router over the generated route tree (src/app/routes,
// routeTree.gen.ts). Registering it here gives `Link`, `useNavigate` and the
// other hooks the route ids, params and search types of this app.
import { createRouter } from '@tanstack/react-router'
import './lib/history-state'
import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
