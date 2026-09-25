// / — the project index, and with `?new=1` the "新規プロジェクト" dialog
// (lib/project-search.ts).
import { createFileRoute } from '@tanstack/react-router'
import { projectsSearchSchema } from '../../lib/project-search'
import HomePage from '../../pages/home'

export const Route = createFileRoute('/_app/')({
  validateSearch: projectsSearchSchema,
  component: HomePage,
})
