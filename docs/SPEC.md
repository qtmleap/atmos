# atmos API仕様書

`docs/PLAN.md`（5節）で決めたエンドポイント一覧に対して、リクエスト/レスポンスの具体的なスキーマを定義する。型はTypeScriptのinterface表記で記述する（実装時にそのままZod/フロントエンドの型として転用できるように）。

## 本ドキュメントで補ったエンドポイント

PLAN.mdの5節には無いが、5節の用途説明・6節のUI要件を満たすために以下を追加している。実装着手前にPLAN.mdへの反映要否を確認すること。

- `PATCH /api/admin/users/:user_id` — 5節の「ユーザー・ロール管理（作成・ロール変更）」のうち「ロール変更」に対応するエンドポイントが元の表になかったため追加
- `GET /api/projects/:project_id/jobs/:job_id/media` — 6節のrun詳細ページ「画像ギャラリー」を実装するには一覧取得が必要なため追加
- `POST /api/projects` — PLAN.md 10節の未決事項「SDKの`wb.init(project="...")`が何をキーにプロジェクトを検索/作成するか」を解消するため追加。トークンの持ち主が所有するプロジェクトの中で`name`が完全一致するものを使い、無ければ作成する（get-or-create）
- `GET /api/projects/:project_id` — 6節のジョブ一覧・ジョブ詳細ページの見出しとパンくずにプロジェクト名と公開範囲を出すため追加。一覧（`GET /api/projects`）から探すと数百件で破綻する

## 0. 共通事項

### 0.1 フォーマット

- ID: 全てUUID v4文字列
- 日時: 全てISO 8601 UTC文字列（例: `"2026-09-24T12:00:00.000Z"`）
- リクエスト/レスポンスボディ: `Content-Type: application/json`（ファイルアップロードのみ`multipart/form-data`）

### 0.2 認証ヘッダー

| ヘッダー | 付与元 | 用途 |
|---|---|---|
| `Cf-Access-Jwt-Assertion` | Cloudflare Access（ログイン済みブラウザに自動付与） | ブラウザ閲覧時のログイン状態判定 |
| `Authorization: Bearer <token>` | クライアント（Python SDK）が明示的に付与 | SDKからのデータ送信（ingest系） |

### 0.3 共通エラーレスポンス

```ts
interface ErrorResponse {
  error: {
    code: string    // "validation_error" | "unauthenticated" | "forbidden" | "not_found" | "conflict" | "payload_too_large" | "already_initialized" | "internal_error" など
    message: string
  }
}
```

以降の各エンドポイントでは、共通的に起こりうる`401 unauthenticated`（Bearer/Access必須なのに未提供）・`403 forbidden`（権限なし）・`500 internal_error`は省略し、そのエンドポイント固有のエラーのみ記載する。

### 0.4 共通ページネーション

一覧系エンドポイントは全て以下のクエリ・レスポンス形式に統一する。

```ts
interface PaginationQuery {
  limit?: number    // デフォルト20、最大100
  cursor?: string   // 前回レスポンスのnext_cursorをそのまま渡す
}

interface Page<T> {
  items: T[]
  next_cursor: string | null   // 次ページが無ければnull
}
```

## 1. 共通スキーマ

```ts
interface User {
  id: string                  // 内部UUID（URLには使わない）
  handle: string               // URL表示用の一意なID（/users/:handleで使用）
  display_name: string
  avatar_url: string | null    // avatar_key未設定ならnull。設定時は /api/users/:handle/avatar
  role: "admin" | "user"
  created_at: string
}

// 管理者・自分自身向けにのみメールアドレスを含む拡張形
interface UserWithEmail extends User {
  cf_access_email: string
}

interface Project {
  id: string
  name: string
  visibility: "public" | "private"
  owner: {
    id: string
    handle: string
    display_name: string
  }
  created_at: string
}

interface Job {
  id: string
  project_id: string
  name: string | null
  status: "running" | "finished" | "failed"
  config: Record<string, unknown>
  created_by: string           // User.id（トークン発行者）
  started_at: string
  finished_at: string | null
}

interface Metric {
  id: string
  job_id: string
  step: number
  key: string
  value: number
  logged_at: string
}

interface MediaAsset {
  id: string
  job_id: string
  step: number
  kind: "image" | "audio"
  label: string
  content_type: string
  size: number                 // バイト数
  url: string                  // GET /api/projects/:project_id/jobs/:job_id/media/:media_id
  logged_at: string
}

interface LogLine {
  id: string
  job_id: string
  stream: "stdout" | "stderr"
  message: string
  logged_at: string
}

interface AccessToken {
  id: string
  issued_at: string
  revoked_at: string | null
}

// 発行直後のレスポンスのみ平文トークンを含む（以降は再取得不可）
interface AccessTokenCreated extends AccessToken {
  token: string
}
```

## 2. Setup

### `POST /api/setup`

認証: Access（ログイン必須ポリシー配下） + `INIT_ADMIN_KEY`

```ts
interface SetupRequest {
  init_admin_key: string
  handle: string
  display_name: string
}

interface SetupResponse {
  user: UserWithEmail
}
```

エラー:
- `403 already_initialized` — `users`テーブルが既に1件以上存在する
- `401 invalid_init_key` — `init_admin_key`が`INIT_ADMIN_KEY`と一致しない

## 3. Admin

### `GET /api/admin/users`

認証: Access（admin）

Query: `PaginationQuery`

Response: `Page<UserWithEmail>`

### `POST /api/admin/users`

認証: Access（admin）

```ts
interface AdminCreateUserRequest {
  cf_access_email: string
  handle: string
  display_name: string
  role: "admin" | "user"
}
```

Response `201`: `UserWithEmail`

エラー:
- `409 conflict` — `handle`または`cf_access_email`が既に使われている

### `PATCH /api/admin/users/:user_id`（追加分）

認証: Access（admin）

```ts
interface AdminUpdateUserRequest {
  role?: "admin" | "user"
}
```

Response: `UserWithEmail`

エラー:
- `404 not_found`
- `409 conflict` — 自分自身を含む最後のadminのroleをuserに変更しようとした場合（管理者0人状態を防止）

## 4. Users

### `GET /api/users`

認証: Access

Query: `PaginationQuery`

Response: `Page<User>`

### `GET /api/users/:handle`

認証: 不要

Response: `User`

エラー: `404 not_found`

### `GET /api/users/:handle/projects`

認証: 不要（非公開プロジェクトの混在有無はAccessで判定）

Query: `PaginationQuery`

Response: `Page<Project>`（閲覧者に権限が無い非公開プロジェクトは結果に含めない）

### `GET /api/users/:handle/avatar`

認証: 不要

Response: `200`、`Content-Type`は保存時の画像形式、bodyはバイナリ

エラー: `404 not_found` — `avatar_key`未設定

### `GET /api/me`

認証: Access

Response: `UserWithEmail`

エラー: `401 unauthenticated`

## 5. Settings

### `PATCH /api/settings/profile`

認証: Access

```ts
interface UpdateProfileRequest {
  handle?: string          // 半角英数・ハイフン・アンダースコアのみ、3〜32文字
  display_name?: string
}
```

Response: `UserWithEmail`

エラー:
- `400 validation_error` — `handle`の形式不正
- `409 conflict` — `handle`が既に使われている

### `PUT /api/settings/avatar`

認証: Access

Request: `multipart/form-data`、フィールド`file`（`image/png` | `image/jpeg` | `image/webp`、最大2MB）

```ts
interface UpdateAvatarResponse {
  avatar_url: string
}
```

エラー:
- `400 invalid_content_type`
- `413 payload_too_large`

### `POST /api/settings/tokens`

認証: Access

Request: ボディなし（発行すると旧トークンは自動失効）

Response `201`: `AccessTokenCreated`

### `DELETE /api/settings/tokens`

認証: Access

Response: `204 No Content`

エラー: `404 not_found` — 有効なトークンが存在しない

## 6. Projects

### `GET /api/projects`

認証: 不要（非公開はAccessで判定）

Query: `PaginationQuery`

Response: `Page<Project>`（閲覧権限のない非公開プロジェクトは結果に含めない）

### `GET /api/projects/:project_id`（追加分）

認証: 不要（非公開ならAccess必須）

Response: `Project`

エラー: `404 not_found`

### `POST /api/projects`（追加分）

認証: Bearer Token（`wb.init(project="...")`のproject解決に対応）

```ts
interface CreateProjectRequest {
  name: string
  visibility?: "public" | "private"   // 省略時は"private"
}
```

動作（get-or-create）:
- トークンの持ち主（owner）が所有するプロジェクトの中に`name`が完全一致するものがあれば、それを返す（新規作成しない）。この場合`visibility`は無視し、既存プロジェクトの値を変更しない
- 無ければ、トークンの持ち主をownerとして新規作成して返す

Response:
- `200`: `Project` — 既存のプロジェクトを返した
- `201`: `Project` — 新規作成した

エラー:
- `400 validation_error` — `name`が空、または`visibility`が不正

補足: `projects.name`はDB上一意ではないため、同じownerの下に同名プロジェクトが既に複数ある場合（将来UIから作成できるようになった場合など）は、`created_at`が最も古いものを返す。

## 7. Jobs

### `POST /api/projects/:project_id/jobs`

認証: Bearer Token（`wb.init()`に対応）

```ts
interface CreateJobRequest {
  name?: string
  config?: Record<string, unknown>
}
```

Response `201`: `Job`（`status: "running"`, `started_at`はサーバー側の受信時刻）

エラー: `404 not_found` — `project_id`が存在しない、またはトークンの持ち主がこのプロジェクトへの書き込み権限を持たない

### `GET /api/projects/:project_id/jobs`

認証: 不要（非公開ならAccess必須）

Query:
```ts
interface ListJobsQuery extends PaginationQuery {
  status?: "running" | "finished" | "failed"
}
```

Response: `Page<Job>`

### `GET /api/projects/:project_id/jobs/:job_id`

認証: 不要（非公開ならAccess必須）

Response: `Job`

エラー: `404 not_found`（`project_id`と`job_id`の親子関係が一致しない場合を含む）

### `POST /api/projects/:project_id/jobs/:job_id/finish`

認証: Bearer Token

```ts
interface FinishJobRequest {
  status: "finished" | "failed"
}
```

Response: `Job`

エラー:
- `404 not_found`
- `409 conflict` — 既に`finished`/`failed`のjobを再度finishしようとした

## 8. Metrics

### `POST /api/projects/:project_id/jobs/:job_id/metrics`

認証: Bearer Token

```ts
interface IngestMetricsRequest {
  metrics: Array<{
    step: number
    key: string
    value: number
    logged_at?: string   // 省略時はサーバー受信時刻を採番
  }>
}
```

Response `202`:
```ts
interface IngestAcceptedResponse {
  accepted: number
}
```

エラー:
- `400 validation_error`
- `404 not_found`
- `413 payload_too_large` — 1リクエストあたりの`metrics`件数上限（1000件想定）超過

### `GET /api/projects/:project_id/jobs/:job_id/metrics`

認証: 不要（非公開ならAccess必須）

Query:
```ts
interface ListMetricsQuery extends PaginationQuery {
  key?: string          // 特定のメトリクス名のみ絞り込み
  since_step?: number
}
```

Response: `Page<Metric>`

## 9. Media

### `POST /api/projects/:project_id/jobs/:job_id/media`

認証: Bearer Token

Request: `multipart/form-data`
- `file`: バイナリ（画像: `image/png`|`image/jpeg`|`image/webp`、音声: `audio/wav`|`audio/mpeg`、最大25MB）
- `kind`: `"image" | "audio"`
- `step`: number
- `label`: string

Response `201`: `MediaAsset`

エラー:
- `400 invalid_content_type` — `kind`と実際のファイル形式が矛盾
- `413 payload_too_large`
- `404 not_found`

### `GET /api/projects/:project_id/jobs/:job_id/media`（追加分）

認証: 不要（非公開ならAccess必須）

Query:
```ts
interface ListMediaQuery extends PaginationQuery {
  kind?: "image" | "audio"
}
```

Response: `Page<MediaAsset>`

### `GET /api/projects/:project_id/jobs/:job_id/media/:media_id`

認証: 不要（非公開ならAccess必須）

Response: `200`、`Content-Type`は`media_assets.content_type`、bodyはバイナリ（Workerがr2からストリーミング）

エラー: `404 not_found`（`job_id`と`media_id`の親子関係不一致を含む）

## 10. Logs

### `POST /api/projects/:project_id/jobs/:job_id/logs`

認証: Bearer Token

```ts
interface IngestLogsRequest {
  logs: Array<{
    stream: "stdout" | "stderr"
    message: string
    logged_at?: string
  }>
}
```

Response `202`: `IngestAcceptedResponse`

エラー: `400 validation_error`、`404 not_found`、`413 payload_too_large`

### `GET /api/projects/:project_id/jobs/:job_id/logs`

認証: 不要（非公開ならAccess必須）

Query:
```ts
interface ListLogsQuery {
  before?: string   // カーソル（このIDより前）
  after?: string    // カーソル（このIDより後）
  limit?: number
}
```

Response: `Page<LogLine>`

## 11. Live（WebSocket）

### `GET /api/projects/:project_id/jobs/:job_id/live`（Upgrade: websocket）

認証: 不要（非公開ならAccess必須。判定はWorkerがUpgrade前に行い、Durable Objectへは可視性判定済みの接続のみハンドオフする）

接続後、クライアント→サーバーのアプリケーションメッセージは無し（単方向push）。サーバー→クライアントは以下のJSON textフレームで送られる。

```ts
type LiveMessage =
  | { type: "metric"; data: Metric }
  | { type: "log"; data: LogLine }
  | { type: "media"; data: MediaAsset }
  | { type: "status"; data: { status: Job["status"]; finished_at: string | null } }
```

Close code:
- `1000` — job側の正常終了、またはクライアント切断
- `4403` — 接続時点で非公開かつ権限なし（Upgrade前にWorkerが弾く想定だが、念のため定義）
- `4404` — `project_id`/`job_id`が存在しない
