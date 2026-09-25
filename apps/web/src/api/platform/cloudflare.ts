// The Cloudflare Workers platform: D1, R2, the JobLive Durable Object, the
// ASSETS binding and Cloudflare Access, all taken from the Worker's env.
import type { BatchItem } from 'drizzle-orm/batch'
import { createDb, type Db } from '../../db/schema'
import type { JobLive } from '../durable-objects/job-live'
import { accessAuthConfig, accessConfigFromEnv } from '../lib/auth'
import type { LiveHub, ObjectStorage, Platform } from './types'

export const cloudflarePlatform = (
  env: CloudflareBindings,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
): Platform => {
  const db = createDb(env.DB)
  return {
    db,
    batch: (build) => d1Batch(db, build(db)),
    storage: r2Storage(env.BUCKET),
    live: durableObjectLiveHub(env.JOB_LIVE),
    auth: accessAuthConfig(accessConfigFromEnv(env)),
    initAdminKey: env.INIT_ADMIN_KEY,
    assets: env.ASSETS,
    waitUntil: (promise) => ctx.waitUntil(promise),
  }
}

// `db.batch` answers each statement with what awaiting that statement alone
// would give, but its result type is a mapped tuple that TypeScript cannot
// relate to `Awaited<Q>[]` for a generic Q. The overload states the element
// type once, here, instead of a cast at every call site.
function d1Batch<Q extends BatchItem<'sqlite'>>(
  db: Db,
  queries: readonly Q[],
): Promise<Awaited<Q>[]>
async function d1Batch(db: Db, queries: readonly BatchItem<'sqlite'>[]): Promise<unknown[]> {
  const [first, ...rest] = queries
  if (first === undefined) {
    return []
  }
  return db.batch([first, ...rest])
}

export const r2Storage = (bucket: R2Bucket): ObjectStorage => ({
  put: async (key, body, { contentType }) => {
    await bucket.put(key, body, { httpMetadata: { contentType } })
  },
  get: async (key) => {
    const object = await bucket.get(key)
    if (object === null) {
      return null
    }
    const contentType =
      object.httpMetadata === undefined ? undefined : object.httpMetadata.contentType
    return { body: object.body, contentType: contentType === undefined ? null : contentType }
  },
  delete: (keys) => bucket.delete([...keys]),
})

export const durableObjectLiveHub = (namespace: DurableObjectNamespace<JobLive>): LiveHub => {
  const stubFor = (jobId: string) => namespace.get(namespace.idFromName(jobId))
  return {
    notify: (jobId, message) => stubFor(jobId).notify(message),
    notifyMany: (jobId, messages) => stubFor(jobId).notifyMany(messages),
    connect: (jobId, request) => stubFor(jobId).fetch(request),
  }
}
