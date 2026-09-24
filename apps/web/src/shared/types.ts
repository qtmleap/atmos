// Wire types shared by the Worker (src/api) and the SPA (src/app).
// Every name follows docs/SPEC.md; section numbers are noted per group.
// This file must stay type-only (plus `as const` tables) so both sides can
// import it without pulling in runtime code.
//
// The object types are derived from the Zod schemas in ./schemas, which are
// the single description of each request and response. Only `import type` is
// used for that, so the derivation adds no runtime import here (and ./schemas
// importing the tables below is not a cycle at runtime). Field-level notes
// live next to the schema fields.
//
// Request types use `z.input` (what a client sends: fields with a server-side
// default stay optional); response types use `z.output`.
import type { z } from 'zod'
import type {
  accessTokenCreatedSchema,
  accessTokenSchema,
  adminCreateUserRequestSchema,
  adminUpdateUserRequestSchema,
  createJobRequestSchema,
  createProjectRequestSchema,
  errorResponseSchema,
  finishJobRequestSchema,
  ingestAcceptedResponseSchema,
  ingestLogItemSchema,
  ingestLogsRequestSchema,
  ingestMetricItemSchema,
  ingestMetricsRequestSchema,
  jobSchema,
  listJobsQuerySchema,
  listLogsQuerySchema,
  listMediaQuerySchema,
  listMetricsQuerySchema,
  liveMessageSchema,
  liveStatusDataSchema,
  logLineSchema,
  mediaAssetSchema,
  metricSchema,
  paginationQuerySchema,
  projectOwnerSchema,
  projectSchema,
  setupRequestSchema,
  setupResponseSchema,
  updateAvatarResponseSchema,
  updateProfileRequestSchema,
  uploadMediaFieldsSchema,
  userSchema,
  userWithEmailSchema,
} from './schemas'

// ---------------------------------------------------------------------------
// Enumerations (docs/SPEC.md §1, docs/SCHEMA.md)
// ---------------------------------------------------------------------------

export const ROLES = ['admin', 'user'] as const
export type Role = (typeof ROLES)[number]

export const VISIBILITIES = ['public', 'private'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export const JOB_STATUSES = ['running', 'finished', 'failed'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

/** Statuses a job can be finished with (`POST .../finish`). */
export const FINISHED_JOB_STATUSES = ['finished', 'failed'] as const
export type FinishedJobStatus = (typeof FINISHED_JOB_STATUSES)[number]

export const MEDIA_KINDS = ['image', 'audio'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export const LOG_STREAMS = ['stdout', 'stderr'] as const
export type LogStream = (typeof LOG_STREAMS)[number]

// ---------------------------------------------------------------------------
// §0.3 Error response
// ---------------------------------------------------------------------------

/**
 * Error codes used across the API. The list in SPEC §0.3 is open ("など");
 * the extra codes below are the endpoint-specific ones SPEC names elsewhere.
 */
export const ERROR_CODES = [
  'validation_error',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'payload_too_large',
  'already_initialized',
  'invalid_init_key',
  'invalid_content_type',
  'internal_error',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export type ErrorResponse = z.output<typeof errorResponseSchema>

// ---------------------------------------------------------------------------
// §0.4 Pagination
// ---------------------------------------------------------------------------

export const PAGINATION_DEFAULT_LIMIT = 20
export const PAGINATION_MAX_LIMIT = 100

/** `limit` defaults to 20 (max 100); `cursor` is the previous page's `next_cursor`. */
export type PaginationQuery = z.input<typeof paginationQuerySchema>

/** Generic over the item type, so it stays a hand-written interface; `pageSchema(item)` builds the matching schema. */
export interface Page<T> {
  items: T[]
  /** null when there is no next page. */
  next_cursor: string | null
}

// ---------------------------------------------------------------------------
// §1 Common schemas
// ---------------------------------------------------------------------------

export type User = z.output<typeof userSchema>

/** Only returned to admins and to the user themself. */
export type UserWithEmail = z.output<typeof userWithEmailSchema>

export type ProjectOwner = z.output<typeof projectOwnerSchema>

export type Project = z.output<typeof projectSchema>

export type Job = z.output<typeof jobSchema>

export type Metric = z.output<typeof metricSchema>

export type MediaAsset = z.output<typeof mediaAssetSchema>

export type LogLine = z.output<typeof logLineSchema>

export type AccessToken = z.output<typeof accessTokenSchema>

/** Only the response right after issuing carries the plaintext token. */
export type AccessTokenCreated = z.output<typeof accessTokenCreatedSchema>

// ---------------------------------------------------------------------------
// §2 Setup — POST /api/setup
// ---------------------------------------------------------------------------

export type SetupRequest = z.input<typeof setupRequestSchema>

export type SetupResponse = z.output<typeof setupResponseSchema>

// ---------------------------------------------------------------------------
// §3 Admin
// GET   /api/admin/users           PaginationQuery -> Page<UserWithEmail>
// POST  /api/admin/users           AdminCreateUserRequest -> 201 UserWithEmail
// PATCH /api/admin/users/:user_id  AdminUpdateUserRequest -> UserWithEmail
// ---------------------------------------------------------------------------

export type AdminCreateUserRequest = z.input<typeof adminCreateUserRequestSchema>

export type AdminUpdateUserRequest = z.input<typeof adminUpdateUserRequestSchema>

// ---------------------------------------------------------------------------
// §4 Users
// GET /api/users                   PaginationQuery -> Page<User>
// GET /api/users/:handle           -> User
// GET /api/users/:handle/projects  PaginationQuery -> Page<Project>
// GET /api/users/:handle/avatar    -> binary
// GET /api/me                      -> UserWithEmail
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// §5 Settings
// PATCH  /api/settings/profile  UpdateProfileRequest -> UserWithEmail
// PUT    /api/settings/avatar   multipart `file` -> UpdateAvatarResponse
// POST   /api/settings/tokens   -> 201 AccessTokenCreated
// DELETE /api/settings/tokens   -> 204
// ---------------------------------------------------------------------------

/** Handle format: ASCII letters, digits, `-` and `_`, 3 to 32 characters. */
export const HANDLE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/

export type UpdateProfileRequest = z.input<typeof updateProfileRequestSchema>

export type UpdateAvatarResponse = z.output<typeof updateAvatarResponseSchema>

export const AVATAR_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number]
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

// ---------------------------------------------------------------------------
// §6 Projects
// GET  /api/projects              PaginationQuery -> Page<Project>
// GET  /api/projects/:project_id  -> Project
// POST /api/projects              CreateProjectRequest -> 200 Project (existing) | 201 Project (created)
// ---------------------------------------------------------------------------

/** `visibility` defaults to "private". */
export type CreateProjectRequest = z.input<typeof createProjectRequestSchema>

// ---------------------------------------------------------------------------
// §7 Jobs
// POST /api/projects/:project_id/jobs                 CreateJobRequest -> 201 Job
// GET  /api/projects/:project_id/jobs                 ListJobsQuery -> Page<Job>
// GET  /api/projects/:project_id/jobs/:job_id         -> Job
// POST /api/projects/:project_id/jobs/:job_id/finish  FinishJobRequest -> Job
// ---------------------------------------------------------------------------

export type CreateJobRequest = z.input<typeof createJobRequestSchema>

export type ListJobsQuery = z.input<typeof listJobsQuerySchema>

export type FinishJobRequest = z.input<typeof finishJobRequestSchema>

// ---------------------------------------------------------------------------
// §8 Metrics
// POST /api/projects/:project_id/jobs/:job_id/metrics  IngestMetricsRequest -> 202 IngestAcceptedResponse
// GET  /api/projects/:project_id/jobs/:job_id/metrics  ListMetricsQuery -> Page<Metric>
// ---------------------------------------------------------------------------

export type IngestMetricItem = z.input<typeof ingestMetricItemSchema>

export type IngestMetricsRequest = z.input<typeof ingestMetricsRequestSchema>

export const INGEST_METRICS_MAX_ITEMS = 1000

export type IngestAcceptedResponse = z.output<typeof ingestAcceptedResponseSchema>

export type ListMetricsQuery = z.input<typeof listMetricsQuerySchema>

// ---------------------------------------------------------------------------
// §9 Media
// POST /api/projects/:project_id/jobs/:job_id/media            multipart -> 201 MediaAsset
// GET  /api/projects/:project_id/jobs/:job_id/media            ListMediaQuery -> Page<MediaAsset>
// GET  /api/projects/:project_id/jobs/:job_id/media/:media_id  -> binary
// ---------------------------------------------------------------------------

/** Text fields of the multipart upload, after parsing; the binary goes in the `file` field. */
export type UploadMediaFields = z.output<typeof uploadMediaFieldsSchema>

export const MEDIA_CONTENT_TYPES = {
  image: ['image/png', 'image/jpeg', 'image/webp'],
  audio: ['audio/wav', 'audio/mpeg'],
} as const satisfies Record<MediaKind, readonly string[]>
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024

export type ListMediaQuery = z.input<typeof listMediaQuerySchema>

// ---------------------------------------------------------------------------
// §10 Logs
// POST /api/projects/:project_id/jobs/:job_id/logs  IngestLogsRequest -> 202 IngestAcceptedResponse
// GET  /api/projects/:project_id/jobs/:job_id/logs  ListLogsQuery -> Page<LogLine>
// ---------------------------------------------------------------------------

export type IngestLogItem = z.input<typeof ingestLogItemSchema>

/**
 * `z.output`, not `z.input`: SPEC requires `logs`, and the server-side
 * `.default([])` is leniency, not part of the contract a client writes to.
 */
export type IngestLogsRequest = z.output<typeof ingestLogsRequestSchema>

export type ListLogsQuery = z.input<typeof listLogsQuerySchema>

// ---------------------------------------------------------------------------
// §11 Live (WebSocket)
// GET /api/projects/:project_id/jobs/:job_id/live  (Upgrade: websocket)
// ---------------------------------------------------------------------------

export type LiveStatusData = z.output<typeof liveStatusDataSchema>

export type LiveMessage = z.output<typeof liveMessageSchema>

export const LIVE_CLOSE_CODES = {
  /** The job ended normally, or the client disconnected. */
  normal: 1000,
  /** Private project and the viewer has no permission. */
  forbidden: 4403,
  /** project_id / job_id does not exist. */
  notFound: 4404,
} as const
export type LiveCloseCode = (typeof LIVE_CLOSE_CODES)[keyof typeof LIVE_CLOSE_CODES]
