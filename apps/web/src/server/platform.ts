// Assembles the self-hosted Platform (src/api/platform/types.ts) from a
// ServerConfig (config.ts) and an already-open PgDatabase
// (src/db/pg/client.ts createPgDatabase): PostgreSQL for `db`/`batch`, a
// local directory for `storage` (storage.ts), the in-process LiveHub for
// `live` (live-hub.ts) and STATIC_DIR for `assets` (static.ts).

import type { Platform } from '../api/platform/types'
import type { PgDatabase } from '../db/pg/client'
import type { ServerConfig } from './config'
import type { InProcessLiveHub } from './live-hub'
import { filesystemAssets } from './static'
import { filesystemStorage } from './storage'

/** The self-hosted Platform, plus a way to wait for background work before shutting down (src/server/index.ts). */
export interface ServerPlatform extends Platform {
  /** Resolves once every promise handed to `waitUntil` so far has settled. */
  drain(): Promise<void>
}

/**
 * `Platform.waitUntil` has nowhere to run background work after the request
 * (there is no ExecutionContext here): this tracks each promise instead, so
 * a rejection is logged rather than becoming an unhandled rejection, and
 * `drain` can await everything still in flight during a graceful shutdown.
 */
const createWaitUntil = (): {
  waitUntil: Platform['waitUntil']
  drain: () => Promise<void>
} => {
  const pending = new Set<Promise<void>>()
  const waitUntil: Platform['waitUntil'] = (promise) => {
    const tracked: Promise<void> = promise.then(
      () => {},
      (error: unknown) => {
        console.error('background task failed', error)
      },
    )
    pending.add(tracked)
    tracked.finally(() => {
      pending.delete(tracked)
    })
  }
  return { waitUntil, drain: () => Promise.all(pending).then(() => {}) }
}

export const createServerPlatform = (
  config: ServerConfig,
  pg: PgDatabase,
  live: InProcessLiveHub,
): ServerPlatform => {
  const { waitUntil, drain } = createWaitUntil()
  return {
    db: pg.db,
    batch: pg.batch,
    storage: filesystemStorage(config.dataDir),
    live,
    auth: config.auth,
    initAdminKey: config.initAdminKey,
    assets: filesystemAssets(config.staticDir),
    waitUntil,
    drain,
  }
}
