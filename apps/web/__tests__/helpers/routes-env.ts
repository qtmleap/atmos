// Miniflare test environment for the setup/admin/users/settings route group,
// mirroring helpers/miniflare.ts's createTestEnv but bundling
// routes-test-worker.ts instead of the real app (see that file for why).
// D1 (migrations applied) and R2 are real (miniflare-local); the Access JWKS
// endpoint is faked the same way, so Cf-Access-Jwt-Assertion verification
// behaves like it does against the real Worker.
import { resolve } from 'node:path'
import {
  convertV4MiniflareOptions,
  type DispatchFetch,
  Miniflare,
  type Response as MiniflareResponse,
} from 'miniflare'
import { accessCertsUrl } from '../../src/api/lib/auth'
import { createFakeAccess, type FakeAccess, TEST_ACCESS_AUD, TEST_TEAM_DOMAIN } from './access'
import { applyMigrations, bundleWorker } from './miniflare'

const ROUTES_WORKER_ENTRY = resolve(import.meta.dir, 'routes-test-worker.ts')

export interface RoutesTestEnv {
  mf: Miniflare
  env: CloudflareBindings
  access: FakeAccess
  /** dispatchFetch against the routes-only test Worker; `path` is relative to the origin. */
  dispatch: (path: string, init?: Parameters<DispatchFetch>[1]) => Promise<MiniflareResponse>
  dispose: () => Promise<void>
}

export const createRoutesTestEnv = async (): Promise<RoutesTestEnv> => {
  const access = await createFakeAccess()
  const certsUrl = accessCertsUrl(TEST_TEAM_DOMAIN).toString()

  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        {
          type: 'ESModule',
          path: 'routes-worker.js',
          contents: await bundleWorker(ROUTES_WORKER_ENTRY),
        },
      ],
      compatibilityDate: '2026-01-01',
      compatibilityFlags: ['nodejs_compat_v2'],
      bindings: {
        ACCESS_TEAM_DOMAIN: TEST_TEAM_DOMAIN,
        ACCESS_AUD: TEST_ACCESS_AUD,
        INIT_ADMIN_KEY: 'test-init-admin-key',
      },
      d1Databases: ['DB'],
      r2Buckets: ['BUCKET'],
      outboundService: (request: Request) => {
        if (request.url === certsUrl) {
          return Response.json(access.jwks)
        }
        return new Response('unexpected outbound fetch', { status: 599 })
      },
    }),
  )

  const env = await mf.getBindings<CloudflareBindings>()
  await applyMigrations(env.DB)

  return {
    mf,
    env,
    access,
    dispatch: (path, init) => mf.dispatchFetch(`http://atmos.test${path}`, init),
    dispose: () => mf.dispose(),
  }
}
