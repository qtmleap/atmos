// D1 schema. Mirrors docs/SCHEMA.md table for table, column for column.
// The index callbacks use Drizzle's array form (the object form in the doc is
// deprecated in drizzle-orm 0.45); the generated SQL is identical.
// docs/SCHEMA.md states enum columns are "TEXT with a CHECK constraint", but
// Drizzle's `text(..., { enum })` only narrows the TS type, so the CHECK
// constraints are declared explicitly with `check(...)`.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    handle: text('handle').notNull(),
    displayName: text('display_name').notNull(),
    avatarKey: text('avatar_key'),
    cfAccessEmail: text('cf_access_email').notNull(),
    role: text('role', { enum: ['admin', 'user'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [
    uniqueIndex('users_handle_unique').on(t.handle),
    uniqueIndex('users_cf_access_email_unique').on(t.cfAccessEmail),
    check('users_role_check', sql`${t.role} IN ('admin', 'user')`),
  ],
)

export const accessTokens = sqliteTable(
  'access_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    issuedAt: integer('issued_at', { mode: 'timestamp' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('access_tokens_token_hash_unique').on(t.tokenHash),
    index('access_tokens_user_id_idx').on(t.userId),
  ],
)

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    visibility: text('visibility', { enum: ['public', 'private'] }).notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [
    index('projects_owner_id_idx').on(t.ownerId),
    check('projects_visibility_check', sql`${t.visibility} IN ('public', 'private')`),
  ],
)

export const jobs = sqliteTable(
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
    config: text('config', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('jobs_project_id_idx').on(t.projectId),
    index('jobs_project_id_status_idx').on(t.projectId, t.status),
    check('jobs_status_check', sql`${t.status} IN ('running', 'finished', 'failed')`),
  ],
)

export const metrics = sqliteTable(
  'metrics',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    step: integer('step').notNull(),
    key: text('key').notNull(),
    value: real('value').notNull(),
    loggedAt: integer('logged_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('metrics_job_id_key_step_idx').on(t.jobId, t.key, t.step)],
)

export const mediaAssets = sqliteTable(
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
    loggedAt: integer('logged_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [
    index('media_assets_job_id_idx').on(t.jobId),
    check('media_assets_kind_check', sql`${t.kind} IN ('image', 'audio')`),
  ],
)

export const logs = sqliteTable(
  'logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    stream: text('stream', { enum: ['stdout', 'stderr'] }).notNull(),
    message: text('message').notNull(),
    loggedAt: integer('logged_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [
    index('logs_job_id_idx').on(t.jobId),
    check('logs_stream_check', sql`${t.stream} IN ('stdout', 'stderr')`),
  ],
)

/** Drizzle client over the D1 binding: `const db = createDb(c.env.DB)`. */
export const createDb = (d1: D1Database) =>
  drizzle(d1, {
    schema: { users, accessTokens, projects, jobs, metrics, mediaAssets, logs },
  })
export type Db = ReturnType<typeof createDb>

export type UserRow = typeof users.$inferSelect
export type AccessTokenRow = typeof accessTokens.$inferSelect
export type ProjectRow = typeof projects.$inferSelect
export type JobRow = typeof jobs.$inferSelect
export type MetricRow = typeof metrics.$inferSelect
export type MediaAssetRow = typeof mediaAssets.$inferSelect
export type LogRow = typeof logs.$inferSelect
