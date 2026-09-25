import { createFileRoute } from '@tanstack/react-router'
import { jobSearchSchema } from '../../lib/manage-search'
import JobDetailPage from '../../pages/job-detail'

export const Route = createFileRoute('/_app/projects/$projectId/jobs/$jobId')({
  validateSearch: jobSearchSchema,
  component: JobDetailPage,
})
