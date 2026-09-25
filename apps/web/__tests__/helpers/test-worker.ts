// Worker entry used by the integration tests: the real app plus a few
// test-only routes that reach helpers which no production route exposes yet.
// Bundled by helpers/miniflare.ts; never deployed.
import { Hono } from 'hono'
import { app } from '../../src/api/app'
import { requireAccessUser, resolveViewer } from '../../src/api/lib/auth'
import { handleError } from '../../src/api/lib/errors'
import { connectLive } from '../../src/api/lib/live'
import { type AppEnv, getPlatform } from '../../src/api/platform/context'

const testApp = new Hono<AppEnv>()

testApp.onError(handleError)

// Visibility checks go through the live JWKS fetch (outboundService in the test).
testApp.get('/__test/viewer', async (c) => {
  const viewer = await resolveViewer(getPlatform(c), c.req.raw)
  return c.json({ viewer: viewer === null ? null : viewer.handle })
})

testApp.get('/__test/me', async (c) => {
  const user = await requireAccessUser(getPlatform(c), c.req.raw)
  return c.json({ handle: user.handle })
})

testApp.get('/__test/live/:job_id', (c) =>
  connectLive(getPlatform(c).live, c.req.param('job_id'), c.req.raw),
)

testApp.route('/', app)

export { JobLive } from '../../src/api/durable-objects/job-live'

export default {
  fetch: testApp.fetch,
} satisfies ExportedHandler<CloudflareBindings>
