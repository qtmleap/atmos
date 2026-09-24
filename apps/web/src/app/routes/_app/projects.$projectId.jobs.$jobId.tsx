import { createFileRoute } from '@tanstack/react-router'
import JobDetailPage from '../../pages/job-detail'

export const Route = createFileRoute('/_app/projects/$projectId/jobs/$jobId')({
  component: JobDetailPage,
})
