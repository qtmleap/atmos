// PostgreSQL mirror of src/db/schema.ts. Same tables, same TS property
// names, same `$inferSelect` shapes (asserted below), so app code that
// imports from '#schema' type-checks identically whether that resolves here
// (`--conditions=postgres`, package.json "imports") or to the D1 schema.
//
// `Db` and the row types are not redeclared here: they are re-exported from
// '../schema' so both conditions hand out the exact same type, not merely a
// structurally equal one.
//
// The D1 schema has no `relations(...)` calls; drizzle infers them from
// `.references()` (relational query builder v2), so there is nothing extra
// to mirror here either.
//
// `createDb` is not re-exported: nothing imports it through '#schema' today
// (grepped) — the one caller, src/api/platform/cloudflare.ts, imports it
// straight from '../../db/schema'. See the implementer's report for
// src/db/pg/client.ts's `createPgDatabase`, which is what the self-hosted
// server actually calls.

import dayjs from 'dayjs'
import { type Equal, sql } from 'drizzle-orm'
import {
  bigint,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type * as sqliteSchema from '../schema'

export const DIALECT = 'postgresql' as const

// D1 stores `mode: 'timestamp'` columns as whole Unix seconds (drizzle-orm's
// SQLiteTimestamp floors to the second on write, see sqlite-core/columns/
// integer.ts). This customType keeps the same TS shape (Date) and the same
// second precision on `timestamptz(0)`, flooring explicitly instead of
// relying on Postgres's own (round-to-nearest) truncation.
const timestampSeconds = customType<{ data: Date; driverData: string }>({
  dataType() {
    return 'timestamptz(0)'
  },
  toDriver(value) {
    return dayjs(value).startOf('second').toISOString()
  },
  fromDriver(value) {
    return dayjs(value).toDate()
  },
})

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    handle: text('handle').notNull(),
    displayName: text('display_name').notNull(),
    avatarKey: text('avatar_key'),
    cfAccessEmail: text('cf_access_email').notNull(),
    role: text('role', { enum: ['admin', 'user'] }).notNull(),
    createdAt: timestampSeconds('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('users_handle_unique').on(t.handle),
    uniqueIndex('users_cf_access_email_unique').on(t.cfAccessEmail),
    check('users_role_check', sql`${t.role} IN ('admin', 'user')`),
  ],
)

export const accessTokens = pgTable(
  'access_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    // First and last 4 characters of the plaintext, so the settings page can
    // tell tokens apart. Null for tokens issued before the column existed.
    tokenHint: text('token_hint'),
    issuedAt: timestampSeconds('issued_at').notNull(),
    revokedAt: timestampSeconds('revoked_at'),
  },
  (t) => [
    uniqueIndex('access_tokens_token_hash_unique').on(t.tokenHash),
    index('access_tokens_user_id_idx').on(t.userId),
  ],
)

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    visibility: text('visibility', { enum: ['public', 'internal', 'private'] }).notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestampSeconds('created_at').notNull(),
  },
  (t) => [
    index('projects_owner_id_idx').on(t.ownerId),
    check('projects_visibility_check', sql`${t.visibility} IN ('public', 'internal', 'private')`),
  ],
)

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name'),
    status: text('status', { enum: ['running', 'finished', 'failed'] })
      .notNull()
      .default('running'),
    config: jsonb('config').notNull().$type<Record<string, unknown>>(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    startedAt: timestampSeconds('started_at').notNull(),
    finishedAt: timestampSeconds('finished_at'),
  },
  (t) => [
    index('jobs_project_id_idx').on(t.projectId),
    index('jobs_project_id_status_idx').on(t.projectId, t.status),
    check('jobs_status_check', sql`${t.status} IN ('running', 'finished', 'failed')`),
  ],
)

export const metrics = pgTable(
  'metrics',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    step: integer('step').notNull(),
    key: text('key').notNull(),
    value: doublePrecision('value').notNull(),
    loggedAt: timestampSeconds('logged_at').notNull(),
  },
  (t) => [index('metrics_job_id_key_step_idx').on(t.jobId, t.key, t.step)],
)

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    step: integer('step').notNull(),
    kind: text('kind', { enum: ['image', 'audio'] }).notNull(),
    label: text('label').notNull(),
    r2Key: text('r2_key').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    loggedAt: timestampSeconds('logged_at').notNull(),
  },
  (t) => [
    index('media_assets_job_id_idx').on(t.jobId),
    check('media_assets_kind_check', sql`${t.kind} IN ('image', 'audio')`),
  ],
)

export const logs = pgTable(
  'logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    stream: text('stream', { enum: ['stdout', 'stderr'] }).notNull(),
    message: text('message').notNull(),
    loggedAt: timestampSeconds('logged_at').notNull(),
  },
  (t) => [
    index('logs_job_id_idx').on(t.jobId),
    check('logs_stream_check', sql`${t.stream} IN ('stdout', 'stderr')`),
  ],
)

export type {
  AccessTokenRow,
  Db,
  JobRow,
  LogRow,
  MediaAssetRow,
  MetricRow,
  ProjectRow,
  UserRow,
} from '../schema'

// ---------------------------------------------------------------------------
// Compile-time parity: each pg table's $inferSelect must equal the sqlite
// one exactly (not merely assignable both ways), or one of these aliases
// fails to compile.
// ---------------------------------------------------------------------------

// Not `AssertEqual<A, B> = AssertTrue<Equal<A, B>>`: with A/B still abstract,
// TypeScript checks a generic alias's body against `extends true` before any
// instantiation, and `Equal<A, B>` unresolved widens to `boolean`. Asserting
// directly, with both sides already concrete, evaluates `Equal` eagerly.
type AssertTrue<T extends true> = T

type _UsersRowParity = AssertTrue<
  Equal<typeof users.$inferSelect, typeof sqliteSchema.users.$inferSelect>
>
type _AccessTokensRowParity = AssertTrue<
  Equal<typeof accessTokens.$inferSelect, typeof sqliteSchema.accessTokens.$inferSelect>
>
type _ProjectsRowParity = AssertTrue<
  Equal<typeof projects.$inferSelect, typeof sqliteSchema.projects.$inferSelect>
>
type _JobsRowParity = AssertTrue<
  Equal<typeof jobs.$inferSelect, typeof sqliteSchema.jobs.$inferSelect>
>
type _MetricsRowParity = AssertTrue<
  Equal<typeof metrics.$inferSelect, typeof sqliteSchema.metrics.$inferSelect>
>
type _MediaAssetsRowParity = AssertTrue<
  Equal<typeof mediaAssets.$inferSelect, typeof sqliteSchema.mediaAssets.$inferSelect>
>
type _LogsRowParity = AssertTrue<
  Equal<typeof logs.$inferSelect, typeof sqliteSchema.logs.$inferSelect>
>
