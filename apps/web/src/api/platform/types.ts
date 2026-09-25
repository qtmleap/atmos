// What the API needs from the place it runs on. Routes never touch a runtime
// binding directly; they call getPlatform(c) (./context.ts) and use this.
//
//   - Cloudflare Workers (./cloudflare.ts): D1, R2, the JobLive Durable
//     Object, the ASSETS binding and Cloudflare Access.
//   - The self-hosted Bun server (src/server/): PostgreSQL, a local
//     directory, an in-process WebSocket hub, dist/client and any OIDC issuer.
import type { BatchItem } from 'drizzle-orm/batch'
import type { Db } from '../../db/schema'
import type { LiveMessage } from '../../shared/types'
import type { NotifyResult } from '../durable-objects/job-live'
import type { AuthConfig } from '../lib/auth'

export type { NotifyResult }

export interface StoredObject {
  body: ReadableStream
  /** The content type given to `put`, or null when the store does not know it. */
  contentType: string | null
}

/** Blob storage for media assets and avatars (R2, or a local directory). */
export interface ObjectStorage {
  put(key: string, body: Blob | Uint8Array, options: { contentType: string }): Promise<void>
  get(key: string): Promise<StoredObject | null>
  /** Deletes at most 1000 keys per call (the R2 limit); missing keys are ignored. */
  delete(keys: readonly string[]): Promise<void>
}

/** Fan-out of live messages to the browsers watching a job (docs/SPEC.md §11). */
export interface LiveHub {
  notify(jobId: string, message: LiveMessage): Promise<NotifyResult>
  notifyMany(jobId: string, messages: readonly LiveMessage[]): Promise<NotifyResult>
  /** Answers an already authorized WebSocket upgrade request for `jobId`. */
  connect(jobId: string, request: Request): Promise<Response>
}

export interface StaticAssets {
  /** The SPA: a file when one matches the path, index.html otherwise. */
  fetch(request: Request): Promise<Response>
}

export interface Platform {
  /**
   * Typed as the D1 client on every platform. On PostgreSQL the tables come
   * from src/db/pg/schema.ts through the `#schema` import, and the query
   * builder calls the routes use behave the same on both.
   */
  db: Db
  /**
   * Runs the statements built from `db` in one transaction and returns their
   * results in order: `db.batch` on D1, a transaction on PostgreSQL. Build
   * the statements from the `db` passed in, not from `platform.db`.
   */
  batch<Q extends BatchItem<'sqlite'>>(build: (db: Db) => readonly Q[]): Promise<Awaited<Q>[]>
  storage: ObjectStorage
  live: LiveHub
  auth: AuthConfig
  /** Compared with `init_admin_key` of POST /api/setup. */
  initAdminKey: string
  assets: StaticAssets
  /** Keeps background work (live notifications) running after the response. */
  waitUntil(promise: Promise<unknown>): void
}
