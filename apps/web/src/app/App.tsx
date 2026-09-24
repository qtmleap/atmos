// All client routes (docs/PLAN.md §6) come from the files under ./routes;
// see ./router.ts for the router itself.
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'

export default function App() {
  return <RouterProvider router={router} />
}
