// Standalone Miniflare environment for __tests__/routes/*.test.ts. Bundles
// ./worker.ts (media/logs/live only) instead of the shared
// __tests__/helpers/test-worker.ts, since that entry does not mount these
// routes (see worker.ts). Reuses bundleWorker / applyMigrations /
// DEFAULT_INDEX_HTML from __tests__/helpers/miniflare.ts rather than
// duplicating them.
import { join } from 'node:path'
import {
  convertV4MiniflareOptions,
  type DispatchFetch,
  Miniflare,
  type Response as MiniflareResponse,
} from 'miniflare'
import { accessCertsUrl } from '../../src/api/lib/auth'
import {
  createFakeAccess,
  type FakeAccess,
  TEST_ACCESS_AUD,
  TEST_TEAM_DOMAIN,
} from '../helpers/access'
import { applyMigrations, bundleWorker, DEFAULT_INDEX_HTML } from '../helpers/miniflare'

const WORKER_ENTRY = join(import.meta.dir, 'worker.ts')

export interface RouteTestEnv {
  env: CloudflareBindings
  access: FakeAccess
  /** dispatchFetch against the routes-under-test worker; `path` is relative to the origin. */
  dispatch: (path: string, init?: Parameters<DispatchFetch>[1]) => Promise<MiniflareResponse>
  dispose: () => Promise<void>
}

export const createRouteTestEnv = async (): Promise<RouteTestEnv> => {
  const access = await createFakeAccess()
  const certsUrl = accessCertsUrl(TEST_TEAM_DOMAIN).toString()

  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        { type: 'ESModule', path: 'worker.js', contents: await bundleWorker(WORKER_ENTRY) },
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
      durableObjects: { JOB_LIVE: { className: 'JobLive', useSQLite: true } },
      serviceBindings: {
        ASSETS: () =>
          new Response(DEFAULT_INDEX_HTML, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
      },
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
    env,
    access,
    dispatch: (path, init) => mf.dispatchFetch(`http://atmos.test${path}`, init),
    dispose: () => mf.dispose(),
  }
}
