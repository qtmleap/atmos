// /projects/:projectId — the job list, or the comparison with `?view=compare`.
// The list's state is in the search params (lib/job-filter.ts); the schema
// drops values it does not know instead of failing the route, which is what
// the old "unknown means the default" parsing did.
import { createFileRoute } from '@tanstack/react-router'
import { jobsSearchSchema } from '../../lib/job-filter'
import ProjectJobsPage from '../../pages/project-jobs'

export const Route = createFileRoute('/_app/projects/$projectId/')({
  validateSearch: jobsSearchSchema,
  component: ProjectJobsPage,
})
