// The Hono application: API under /api, SPA (with OGP rewriting) everywhere else.
//
// Route files (src/api/routes/*.ts, written separately) follow one convention:
//
//   export const xxxRoutes = new Hono<AppEnv>()
//
// and reach the database, storage, live hub and auth settings through
// getPlatform(c) (api/platform/context.ts), never through c.env directly, so
// the same routes run on Cloudflare Workers and on the Bun server.
//
// They are mounted onto `api` below with `api.route('/<prefix>', xxxRoutes)`,
// before `app.route('/api', api)` (Hono copies a sub-app's routes when it is
// mounted). Handlers report failures by throwing ApiError (api/lib/errors.ts)
// or by returning errorResponse(...); both produce the docs/SPEC.md §0.3 shape.
import { Hono } from 'hono'
import { errorResponse, handleError } from './lib/errors'
import { ogpMiddleware } from './middleware/ogp'
import { type AppEnv, getPlatform } from './platform/context'
import { adminRoutes } from './routes/admin'
import { jobsRoutes } from './routes/jobs'
import { liveRoutes } from './routes/live'
import { logsRoutes } from './routes/logs'
import { mediaRoutes } from './routes/media'
import { metricsRoutes } from './routes/metrics'
import { projectsRoutes } from './routes/projects'
import { settingsRoutes } from './routes/settings'
import { setupRoutes } from './routes/setup'
import { usersRoutes } from './routes/users'

export type { AppEnv }

export const api = new Hono<AppEnv>()

// Route files that carry their own full path (minus /api) mount at '/'; the
// project-scoped ones are relative to the prefix they are mounted under and
// read :project_id / :job_id from it.
api.route('/', setupRoutes)
api.route('/', adminRoutes)
api.route('/', usersRoutes)
api.route('/', settingsRoutes)
api.route('/projects', projectsRoutes)
api.route('/projects', jobsRoutes)
api.route('/projects', metricsRoutes)
api.route('/projects/:project_id/jobs/:job_id/media', mediaRoutes)
api.route('/projects/:project_id/jobs/:job_id/logs', logsRoutes)
api.route('/projects/:project_id/jobs/:job_id/live', liveRoutes)

export const app = new Hono<AppEnv>()

app.onError(handleError)

app.route('/api', api)

// Unknown /api paths are JSON 404s; they must never fall through to the SPA.
app.all('/api/*', () => errorResponse(404, 'not_found', 'no such API endpoint'))

// SPA: /projects/:id, /projects/:id/jobs/:id and /users/:handle get OGP tags,
// everything else is served from the static assets. On Cloudflare wrangler.toml
// `run_worker_first` decides which paths reach the Worker at all; the ASSETS
// binding applies `not_found_handling = "single-page-application"`, so client
// routes resolve to index.html.
app.use('*', ogpMiddleware)
app.all('*', (c) => getPlatform(c).assets.fetch(c.req.raw))
