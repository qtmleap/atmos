// The self-hosted server's PostgreSQL client (src/server/ calls createPgDatabase
// and migratePg; nothing else should import this file — routes go through
// '#schema' and the Platform interface instead).
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import {
  drizzle,
  type PostgresJsDatabase,
  type PostgresJsTransaction,
} from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import type { Platform } from '../../api/platform/types'
import type { Db } from '../schema'
import { accessTokens, jobs, logs, mediaAssets, metrics, projects, users } from './schema'

const pgSchema = { users, accessTokens, projects, jobs, metrics, mediaAssets, logs }
type PgSchema = typeof pgSchema
type PgRelationalSchema = ExtractTablesWithRelations<PgSchema>

/**
 * Bridges the pg drizzle instance (top-level client or a transaction) to the
 * sqlite `Db` type every route is typed against, the same way cloudflare.ts's
 * `d1Batch` bridges `db.batch`'s result type: the overload states the
 * identity once, so no call site needs an `as` cast.
 *
 * This works at compile time only because the query builder calls routes use
 * (select/insert/update/delete/query.*) have the same shape on both dialects;
 * it is not a runtime conversion, and it is why `Db` stays imported from the
 * D1 schema (src/api/platform/types.ts) instead of being re-derived here.
 */
function asDb(
  raw: PostgresJsDatabase<PgSchema> | PostgresJsTransaction<PgSchema, PgRelationalSchema>,
): Db
function asDb(raw: unknown): unknown {
  return raw
}

/** What the self-hosted server plugs into `Platform`: `db`, `batch` and a shutdown hook. */
export type PgDatabase = { db: Db; batch: Platform['batch']; close(): Promise<void> }

// `query` inside the loop is typed as the generic `Q` (Awaited<Q> for a type
// parameter that TypeScript cannot prove is thenable from its `BatchItem`
// constraint alone), which is the same friction cloudflare.ts's `d1Batch`
// sidesteps: an overload states the precise generic contract once, and the
// implementation signature is untyped so the loop body has no open generic
// left to fight.
function pgBatch<Q extends BatchItem<'sqlite'>>(
  raw: PostgresJsDatabase<PgSchema>,
  build: (db: Db) => readonly Q[],
): Promise<Awaited<Q>[]>
function pgBatch(
  raw: PostgresJsDatabase<PgSchema>,
  build: (db: Db) => readonly BatchItem<'sqlite'>[],
): Promise<unknown[]> {
  // One transaction per call, built from the `db` handed to `build` (the
  // transaction-scoped one, not the outer `raw`/`platform.db`) so the
  // statements actually run inside it and roll back together on failure.
  return raw.transaction(async (tx) => {
    const queries = build(asDb(tx))
    const results: unknown[] = []
    for (const query of queries) {
      results.push(await query)
    }
    return results
  })
}

/** Opens a PostgreSQL connection pool and wraps it as a `PgDatabase`. */
export const createPgDatabase = (url: string): PgDatabase => {
  const client = postgres(url)
  const raw = drizzle(client, { schema: pgSchema })
  return {
    db: asDb(raw),
    batch: (build) => pgBatch(raw, build),
    close: () => client.end(),
  }
}

const defaultMigrationsFolder = `${import.meta.dir}/migrations`

/**
 * Applies every migration in src/db/pg/migrations (drizzle-kit generated,
 * never hand-written) to `url`. `migrationsFolder` defaults to the folder
 * next to this file, resolved via `import.meta.dir` so it also works when
 * this module is bundled into dist (the migrations folder must be copied
 * alongside the bundle); pass it explicitly to override.
 */
export const migratePg = async (
  url: string,
  migrationsFolder: string = defaultMigrationsFolder,
): Promise<void> => {
  const client = postgres(url, { max: 1 })
  const raw = drizzle(client, { schema: pgSchema })
  await migrate(raw, { migrationsFolder })
  await client.end()
}
