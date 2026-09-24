// Component catalog (/catalog/*), compared against the mocks in
// docs/mock-diff/designs/components/. Dev only: the import.meta.env.DEV
// guard lets the production build drop these chunks. The catalog has its own
// masthead, as the mocks do, so it renders outside the _app layout.
import { createFileRoute, notFound } from '@tanstack/react-router'
import { type ComponentType, lazy, Suspense } from 'react'

const catalogPages: ReadonlyMap<string, ComponentType> = new Map(
  import.meta.env.DEV
    ? [
        ['foundations', lazy(() => import('../pages/catalog/foundations'))],
        ['controls', lazy(() => import('../pages/catalog/controls'))],
        ['data-display', lazy(() => import('../pages/catalog/data-display'))],
        ['navigation', lazy(() => import('../pages/catalog/navigation'))],
        ['overlays', lazy(() => import('../pages/catalog/overlays'))],
        ['run-widgets', lazy(() => import('../pages/catalog/run-widgets'))],
        ['feedback', lazy(() => import('../pages/catalog/feedback'))],
      ]
    : [],
)

export const Route = createFileRoute('/catalog/$section')({
  loader: ({ params }) => {
    if (!catalogPages.has(params.section)) {
      throw notFound()
    }
  },
  component: CatalogRoute,
})

function CatalogRoute() {
  const { section } = Route.useParams()
  const Page = catalogPages.get(section)
  if (Page === undefined) {
    return null
  }
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  )
}
