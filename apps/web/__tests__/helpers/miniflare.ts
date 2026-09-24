// Integration test environment: the Worker bundled with Bun.build and run in
// workerd through miniflare, with a local D1 (migrations applied), R2, the
// JobLive Durable Object, a stub ASSETS service and a fake Access JWKS
// endpoint. No Cloudflare account is involved.
//
// miniflare 5 takes a new option shape; convertV4MiniflareOptions accepts the
// documented (v4) shape used here.
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  convertV4MiniflareOptions,
  type DispatchFetch,
  Miniflare,
  type Response as MiniflareResponse,
} from 'miniflare'
import { accessCertsUrl } from '../../src/api/lib/auth'
import { createFakeAccess, type FakeAccess, TEST_ACCESS_AUD, TEST_TEAM_DOMAIN } from './access'

const WEB_ROOT = resolve(import.meta.dir, '../..')
const MIGRATIONS_DIR = join(WEB_ROOT, 'src/db/migrations')
const TEST_WORKER_ENTRY = join(import.meta.dir, 'test-worker.ts')

export const DEFAULT_INDEX_HTML = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>atmos</title>
    <meta name="description" content="default description" />
    <meta property="og:title" content="atmos" />
  </head>
  <body><div id="root"></div></body>
</html>
`

const bundleCache = new Map<string, Promise<string>>()

/** Bundles a Worker entry into one ES module (npm dependencies inlined). */
export const bundleWorker = (entry: string): Promise<string> => {
  const cached = bundleCache.get(entry)
  if (cached !== undefined) {
    return cached
  }
  const built = Bun.build({
    entrypoints: [entry],
    target: 'browser',
    format: 'esm',
    conditions: ['workerd', 'worker', 'browser'],
    external: ['cloudflare:*'],
  }).then(async (result) => {
    const output = result.outputs[0]
    if (!result.success || output === undefined) {
      throw new AggregateError(result.logs, `failed to bundle ${entry}`)
    }
    return output.text()
  })
  bundleCache.set(entry, built)
  return built
}

/** SQL statements of every migration, in file order. */
export const readMigrationStatements = async (): Promise<string[]> => {
  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort()
  const contents = await Promise.all(
    files.map((name) => readFile(join(MIGRATIONS_DIR, name), 'utf8')),
  )
  return contents
    .flatMap((sql) => sql.split('--> statement-breakpoint'))
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

export const applyMigrations = async (db: D1Database): Promise<void> => {
  const statements = await readMigrationStatements()
  await db.batch(statements.map((statement) => db.prepare(statement)))
}

export interface TestEnvOptions {
  /** Body the stub ASSETS binding returns for every request. */
  indexHtml?: string
}

export interface TestEnv {
  mf: Miniflare
  env: CloudflareBindings
  access: FakeAccess
  /** Requests the stub ASSETS binding received. */
  assetRequests: string[]
  /** Number of times the Worker fetched the Access JWKS. */
  jwksFetches: () => number
  /** dispatchFetch against the test Worker; `path` is relative to the origin. */
  dispatch: (path: string, init?: Parameters<DispatchFetch>[1]) => Promise<MiniflareResponse>
  dispose: () => Promise<void>
}

export const createTestEnv = async (options: TestEnvOptions = {}): Promise<TestEnv> => {
  const access = await createFakeAccess()
  const indexHtml = options.indexHtml === undefined ? DEFAULT_INDEX_HTML : options.indexHtml
  const assetRequests: string[] = []
  const jwksCounter = { count: 0 }
  const certsUrl = accessCertsUrl(TEST_TEAM_DOMAIN).toString()

  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        { type: 'ESModule', path: 'worker.js', contents: await bundleWorker(TEST_WORKER_ENTRY) },
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
        ASSETS: (request: Request) => {
          assetRequests.push(new URL(request.url).pathname)
          return new Response(indexHtml, {
            headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"asset"' },
          })
        },
      },
      outboundService: (request: Request) => {
        if (request.url === certsUrl) {
          jwksCounter.count += 1
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
    assetRequests,
    jwksFetches: () => jwksCounter.count,
    dispatch: (path, init) => mf.dispatchFetch(`http://atmos.test${path}`, init),
    dispose: () => mf.dispose(),
  }
}
