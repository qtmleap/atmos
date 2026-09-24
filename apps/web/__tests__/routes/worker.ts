// Worker entry used only by __tests__/routes/*.test.ts. Mounts every route
// group under test (projects/jobs/metrics/media/logs/live). src/api/app.ts
// does not mount them yet — wiring them into the real app is a separate
// delegation — so this stays independent of the shared
// __tests__/helpers/test-worker.ts, which only exposes narrow test-only
// endpoints for other lib tests.
//
// The mount prefixes below are this route group's assumption about how
// src/api/app.ts will eventually mount them (docs/SPEC.md §6-§11 paths).
// projects/jobs/metrics read `project_id` / `job_id` themselves (docs/SPEC.md
// §7/§8), so they share the `/api/projects` prefix; media/logs/live read
// them from the mount prefix instead.
import { Hono } from 'hono'
import { errorResponse, handleError } from '../../src/api/lib/errors'
import { jobsRoutes } from '../../src/api/routes/jobs'
import { liveRoutes } from '../../src/api/routes/live'
import { logsRoutes } from '../../src/api/routes/logs'
import { mediaRoutes } from '../../src/api/routes/media'
import { metricsRoutes } from '../../src/api/routes/metrics'
import { projectsRoutes } from '../../src/api/routes/projects'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.onError(handleError)

app.route('/api/projects', projectsRoutes)
app.route('/api/projects', jobsRoutes)
app.route('/api/projects', metricsRoutes)
app.route('/api/projects/:project_id/jobs/:job_id/media', mediaRoutes)
app.route('/api/projects/:project_id/jobs/:job_id/logs', logsRoutes)
app.route('/api/projects/:project_id/jobs/:job_id/live', liveRoutes)

app.all('*', () => errorResponse(404, 'not_found', 'no such route'))

export { JobLive } from '../../src/api/durable-objects/job-live'

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<CloudflareBindings>
