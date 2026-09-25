// Renders pages through the real route tree so params, search params and
// links behave as they do in the app. The _app layout comes along, so its
// header (and one /api/me fetch) is part of every page render.
//
// `bun run test` sets NODE_ENV=test: under Bun, @tanstack/router-core
// resolves its `isServer` flag to true for any other value and the router
// then skips the client-side transition machinery the pages rely on.

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type * as React from 'react'
import { routeTree } from '../../src/app/routeTree.gen'

/** Mounts the app at `path` (pathname plus search) and waits for the first load. */
export const renderRoute = async (path: string) => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}

/** Mounts a bare component that only needs a router for its links. */
export const renderInRouter = async (element: React.ReactNode) => {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => element }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}
