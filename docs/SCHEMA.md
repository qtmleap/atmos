# atmos D1スキーマ（Drizzle ORM）

`docs/PLAN.md`（2節）のデータモデルを、実装にそのまま使えるDrizzle ORM（`drizzle-orm/sqlite-core`）のテーブル定義に落とし込んだもの。

## 方針

- **ID**: API/URLに直接露出するテーブル（`users`, `projects`, `jobs`, `access_tokens`, `media_assets`）は`TEXT`のUUID v4。高頻度に追記され、URLには出ない`metrics`・`logs`のみ`INTEGER PRIMARY KEY AUTOINCREMENT`（`SPEC.md`の「IDは全てUUID」からの例外）。理由は、単調増加する整数IDの方がカーソルページネーション（`WHERE id > :cursor ORDER BY id`）と相性が良く、UUID文字列よりインデックス・行サイズが小さいため。
- **日時**: DB上は`integer(mode: "timestamp")`（Unixエポック秒）で保持する。API応答時にISO 8601文字列へ変換するのはAPI層の責務（`SPEC.md`の日時形式とは表現が異なるが、DBの内部表現とAPIのワイヤーフォーマットは別レイヤーの話として扱う）。
- **ENUM**: SQLiteにネイティブなENUM型は無いため、Drizzleの`text(..., { enum: [...] })`で型安全にしつつ、実体は`CHECK`制約付きの`TEXT`。
- **JSON**: `jobs.config`は`text(..., { mode: "json" })`で保存し、Drizzle側でオブジェクトとして扱う。
- **外部キー**: `jobs`→`metrics`/`media_assets`/`logs`は`ON DELETE CASCADE`（jobを消せば付随データも消える）。`projects`→`jobs`も`ON DELETE CASCADE`。`users`→`projects`/`access_tokens`は現状ユーザー削除APIが無いためデフォルト（NO ACTION）のままとし、必要になった時点で挙動を決める。

## テーブル定義

```ts
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    avatarKey: text("avatar_key"),
    cfAccessEmail: text("cf_access_email").notNull(),
    role: text("role", { enum: ["admin", "user"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    handleUnique: uniqueIndex("users_handle_unique").on(t.handle),
    emailUnique: uniqueIndex("users_cf_access_email_unique").on(t.cfAccessEmail),
  }),
);

export const accessTokens = sqliteTable(
  "access_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    issuedAt: integer("issued_at", { mode: "timestamp" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (t) => ({
    tokenHashUnique: uniqueIndex("access_tokens_token_hash_unique").on(t.tokenHash),
    userIdIdx: index("access_tokens_user_id_idx").on(t.userId),
  }),
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    visibility: text("visibility", { enum: ["public", "private"] }).notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    ownerIdIdx: index("projects_owner_id_idx").on(t.ownerId),
  }),
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name"),
    status: text("status", { enum: ["running", "finished", "failed"] })
      .notNull()
      .default("running"),
    config: text("config", { mode: "json" })
      .notNull()
      .$type<Record<string, unknown>>(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp" }),
  },
  (t) => ({
    projectIdIdx: index("jobs_project_id_idx").on(t.projectId),
    projectStatusIdx: index("jobs_project_id_status_idx").on(t.projectId, t.status),
  }),
);

export const metrics = sqliteTable(
  "metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    step: integer("step").notNull(),
    key: text("key").notNull(),
    value: real("value").notNull(),
    loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    jobKeyStepIdx: index("metrics_job_id_key_step_idx").on(t.jobId, t.key, t.step),
  }),
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    step: integer("step").notNull(),
    kind: text("kind", { enum: ["image", "audio"] }).notNull(),
    label: text("label").notNull(),
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    jobIdIdx: index("media_assets_job_id_idx").on(t.jobId),
  }),
);

export const logs = sqliteTable(
  "logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    stream: text("stream", { enum: ["stdout", "stderr"] }).notNull(),
    message: text("message").notNull(),
    loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    jobIdIdx: index("logs_job_id_idx").on(t.jobId),
  }),
);
```

## マイグレーション運用

- `drizzle-kit`でこのスキーマファイルからマイグレーションSQLを生成し、`apps/web/src/db/migrations/`に出力する（`apps/web/src/db/`はPLAN.md 8節のリポジトリ構成に既に記載済み）。
- 適用は`wrangler d1 migrations apply`をデプロイフローに組み込む。
