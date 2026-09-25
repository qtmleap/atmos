// Builds a `Db`-typed handle over an in-memory pglite instance, migrated
// with the exact SQL drizzle-kit generated for real Postgres
// (src/db/pg/migrations). pglite stands in for a real Postgres server so
// __tests__/pg runs without one; it speaks the same SQL dialect and enforces
// the same CHECK/FK constraints as the generated migration.
//
// Imports the pg schema and `Db` by relative path, not '#schema': these
// tests must type-check under the default (sqlite) tsc condition too (only
// their `describe.skipIf` gate is condition-aware), and '#schema' would
// resolve to the sqlite table objects there.
import { PGlite } from '@electric-sql/pglite'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import {
  accessTokens,
  jobs,
  logs,
  mediaAssets,
  metrics,
  projects,
  users,
} from '../../../src/db/pg/schema'
import type { Db } from '../../../src/db/schema'

const pgSchema = { users, accessTokens, projects, jobs, metrics, mediaAssets, logs }
type PgSchema = typeof pgSchema

// Same bridge as src/db/pg/client.ts's `asDb`: states once, at compile time,
// that a pglite-backed database has the shape callers need as `Db`. Not a
// runtime conversion.
function asDb(raw: PgliteDatabase<PgSchema>): Db
function asDb(raw: unknown): unknown {
  return raw
}

export type PgliteTestDb = {
  db: Db
  raw: PgliteDatabase<PgSchema>
  close(): Promise<void>
}

const migrationsFolder = `${import.meta.dir}/../../../src/db/pg/migrations`

/** Fresh in-memory Postgres, migrated, ready for a test. Call `close()` in `afterAll`. */
export const createPgliteTestDb = async (): Promise<PgliteTestDb> => {
  const client = new PGlite()
  const raw = drizzle(client, { schema: pgSchema })
  await migrate(raw, { migrationsFolder })
  return { db: asDb(raw), raw, close: () => client.close() }
}
