// Worker entry for the setup/admin/users/settings route tests.
//
// src/api/app.ts does not mount any route file yet (a later integration step
// wires every group's routes onto it together); this composes just the
// routes this test group owns the same way app.ts documents it will:
// `app.onError(handleError)`, each router mounted at `/` under `/api`, and
// unknown `/api/*` paths answered as JSON 404s. Bundled by helpers/miniflare
// (see routes-env.ts); never deployed.
import { Hono } from 'hono'
import { errorResponse, handleError } from '../../src/api/lib/errors'
import { adminRoutes } from '../../src/api/routes/admin'
import { settingsRoutes } from '../../src/api/routes/settings'
import { setupRoutes } from '../../src/api/routes/setup'
import { usersRoutes } from '../../src/api/routes/users'

type AppEnv = { Bindings: CloudflareBindings }

const api = new Hono<AppEnv>()
api.route('/', setupRoutes)
api.route('/', adminRoutes)
api.route('/', usersRoutes)
api.route('/', settingsRoutes)

const app = new Hono<AppEnv>()
app.onError(handleError)
app.route('/api', api)
app.all('/api/*', () => errorResponse(404, 'not_found', 'no such API endpoint'))

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<CloudflareBindings>
