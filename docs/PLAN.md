# atmos — wandb代替 実験管理ツール 計画書

## 0. 前提・スコープ

- 想定利用規模: チーム最大5人程度。送信済みデータを見る「ビューワ」が主目的だが、ジョブ実行中はチャートが自動更新されるようにする（要リアルタイム更新）。
- v1では wandb Python SDK 互換モード（要件16）は実装しない。独自の軽量Python SDKのみ提供する。
- ホスティングは Cloudflare Workers 単体で完結させる（フロントエンドはWorkers Assetsとして配信、API・データもWorkers上）。
- 認証はユーザー管理を自前実装せず、Cloudflare Accessに委譲する。

## 1. 全体構成

```
[Python SDK] --(Bearer Access Token, HTTPS)--> [Cloudflare Worker API]
                                                     |-- D1 (メタデータ・メトリクス)
                                                     |-- R2 (画像・音声アセット)
                                                     |-- Durable Object (job単位のライブ配信チャネル)
[ブラウザ] --(Cloudflare Access で認証 or 匿名)--> [Cloudflare Worker: SPA配信 + 閲覧API + WebSocket]
```

- **フロントエンド**: Vite + TypeScript + React + shadcn/ui（フラットデザイン）+ Recharts + 最低限のPWA対応
- **バックエンド**: Cloudflare Workers（Honoでルーティング）
- **DB**: Cloudflare D1（SQLite）— メタデータ・メトリクスとも当面はここに集約
- **ストレージ**: Cloudflare R2 — 画像・音声などのアセット
- **リアルタイム配信**: Durable Objects（job_idごとに1インスタンス、WebSocket Hibernation APIで接続を保持）。メトリクスのingest時にWorkerが該当DOへ通知し、DOが接続中のブラウザへpush。D1へのポーリングは行わない
- **認証（人間のログイン）**: Cloudflare Access
- **認証（SDKからのデータ送信）**: ユーザーに紐づくアクセストークン（Bearer）

## 2. データモデル（D1 / Drizzle ORM想定）

| テーブル | 主なカラム | 備考 |
|---|---|---|
| `users` | id, handle, display_name, avatar_key, cf_access_email, role(admin/user), created_at | `id`は内部用UUID（URLには使わない）。`handle`はURL表示用の一意なID（例: 半角英数、`/users/:handle`で使用、本人が`/settings/profile`で設定・変更可）。`display_name`は表示名（自由記述、日本語可）。`avatar_key`はR2に保存したアバター画像のキー。Cloudflare Accessのアイデンティティ（`cf_access_email`）と1:1で紐付け |
| `access_tokens` | id, user_id, token_hash, issued_at, revoked_at | 平文トークンは発行時のみ表示、以降はhashのみ保持。v1は1ユーザー1トークン運用（新規発行で旧トークンを自動失効） |
| `projects` | id, name, visibility(public/private), owner_id, created_at | `id`はURL・APIで使う不透明な識別子（自動採番/UUID）、ユーザーとは異なりURL専用の別IDは持たない。`name`は表示用ラベルで自由記述（日本語可）、URLには使わないがOGPカード（Slack等のリンク展開）のタイトルとして使う |
| `jobs` | id, project_id, name, status(running/finished/failed), config(JSON), created_by, started_at, finished_at | wandbの"run"に相当 |
| `metrics` | id, job_id, step, key, value(REAL), logged_at | `(job_id, key, step)` にインデックス |
| `media_assets` | id, job_id, step, kind(image/audio), label, r2_key, content_type, size, logged_at | 実体はR2、DBはメタデータのみ |
| `logs` | id, job_id, stream(stdout/stderr), message, logged_at | `job_id`にインデックス。標準出力・標準エラー相当のテキスト行 |

永続データはD1のみで開始し、メトリクス・ログの行数が将来的に問題になった場合はR2への時系列オフロードを検討。Durable Objectsはv1から使うが、永続化には使わず「job単位のライブ配信チャネル（接続中クライアントへのfan-out用）」としてのみ利用し、状態は都度D1から読み直せるようにする。

## 3. 認証設計

### 3.1 ブラウザアクセス（人間）

- Cloudflare Access Application が保護するのは次のパスだけで、ポリシーは許可したメンバーだけを通すものが一つだけある。
  - 画面: `/setup`、`/settings`、`/admin`
  - API: `/api/setup`、`/api/me`、`/api/settings`、`/api/admin`、`/api/users`
- `/api/projects/*` は Access の対象外に置く。Everyone を許可する Allow ポリシーも付けない。Allow ポリシーは誰でも通すものでもログイン画面は出すため、SDK からの送信が止まってしまう。
- Access の対象外のパスには `Cf-Access-Jwt-Assertion` ヘッダーが付かない。そこで Worker は、ヘッダーが無ければ `CF_Authorization` Cookie を読み、ヘッダーと同じ検証（署名、AUD、発行元、有効期限）をかけてログイン状態とメールアドレスを判定する。Cookie はホスト全体に付くので、保護されたパスで一度ログインしていれば `/api/projects/*` でも本人と分かる。
- Cookie は別サイトからの要求にも付くため、Cookie だけで本人確認した書き込み（GET、HEAD、OPTIONS 以外）は、`Sec-Fetch-Site: same-origin` か、要求先と一致する `Origin` があるときだけ受け付ける。
- `projects.visibility` が `private` のリソース（プロジェクト、job、メトリクス、メディア）は所有者と管理者だけ、`internal` は登録済みのログインユーザー全員、`public` はログイン不要で閲覧できる。権限が無ければ 403、ログインしていなければ 401 を返す。この判定をリソース単位で一貫して適用する。

### 3.2 SDKからのデータ送信

- `/api/projects/*` 配下のPOST（run作成・メトリクス送信・メディアアップロード・run終了）は Cloudflare Access の対象外なので、Bearerトークン（アクセストークン）だけで認証する。
- トークンは `/settings/tokens` 画面（Access保護下）でユーザー自身がIssue/Revoke可能。
- v1は1ユーザー1トークンのシンプル運用（複数トークンのスキーマ自体は将来拡張余地として残す）。

## 4. 初回セットアップ（要件13）

1. デプロイ時に Wrangler Secret `INIT_ADMIN_KEY` を設定しておく。
2. `/setup` ページはCloudflare Access配下に置き、`users` テーブルが空の場合のみアクセス可能。
3. アクセスした人が `INIT_ADMIN_KEY` を入力すると、そのときのCloudflare Accessアイデンティティ（メールアドレス）を最初の管理者として `users` テーブルに登録。
4. 以降は `users` が1件以上存在する限り `/setup` は403を返し、二度と使えないようにする。

## 5. API設計（概要）

| メソッド/パス | 用途 | 認証 |
|---|---|---|
| `POST /api/setup` | 初期管理者登録 | Access + INIT_ADMIN_KEY |
| `GET/POST /api/admin/users` | ユーザー・ロール管理（作成・ロール変更） | Access（admin） |
| `GET /api/users` | チームメンバー一覧（handle・display_name・avatar程度の最小情報） | Access |
| `GET /api/users/:handle` | ユーザープロフィール取得 | 不要（プロフィール自体は公開情報として扱う） |
| `GET /api/users/:handle/projects` | 指定ユーザーが所有するプロジェクト一覧（マイページ用の絞り込み） | 不要（非公開はAccessで判定） |
| `GET /api/users/:handle/avatar` | アバター画像取得（Workerがr2からストリーミング） | 不要 |
| `GET /api/me` | 自分のユーザー情報取得（マイページへのリンク解決用） | Access |
| `PATCH /api/settings/profile` | 自分のhandle・display_name変更 | Access |
| `PUT /api/settings/avatar` | アバター画像アップロード（Workerがバイナリを受け取りR2へ書き込み） | Access |
| `POST/DELETE /api/settings/tokens` | アクセストークンIssue/Revoke | Access |
| `GET /api/projects` | プロジェクト一覧 | 不要（非公開はAccessで判定） |
| `POST /api/projects/:project_id/jobs` | run作成、`wb.init()`に対応 | Bearer Token |
| `GET /api/projects/:project_id/jobs` | プロジェクト内job一覧 | 不要（非公開ならAccess必須） |
| `GET /api/projects/:project_id/jobs/:job_id` | job詳細 | 不要（非公開ならAccess必須） |
| `POST /api/projects/:project_id/jobs/:job_id/metrics` | メトリクスのバッチ送信 | Bearer Token |
| `GET /api/projects/:project_id/jobs/:job_id/metrics` | メトリクス取得（Rechartsへ渡す） | 不要（非公開ならAccess必須） |
| `POST /api/projects/:project_id/jobs/:job_id/media` | 画像・音声アップロード（Workerがバイナリを受け取りR2へ書き込み） | Bearer Token |
| `GET /api/projects/:project_id/jobs/:job_id/media/:media_id` | アセット取得（Workerがr2からストリーミング） | 不要（非公開ならAccess必須） |
| `POST /api/projects/:project_id/jobs/:job_id/logs` | ログのバッチ送信（stdout/stderr相当） | Bearer Token |
| `GET /api/projects/:project_id/jobs/:job_id/logs` | ログ取得（ページング、`before`/`after`カーソル） | 不要（非公開ならAccess必須） |
| `POST /api/projects/:project_id/jobs/:job_id/finish` | runの終了（status更新） | Bearer Token |
| `GET /api/projects/:project_id/jobs/:job_id/live`（WebSocket Upgrade） | メトリクス・ログ行のリアルタイム配信（該当job_idのDurable Objectに接続） | 不要（非公開ならAccess必須、他GETと同じ判定） |

`:project_id`・`:job_id`・`:media_id`の親子関係が実際のデータと一致しない場合は404を返す。画像・音声はR2バケットを非公開のまま運用し、必ずWorker経由でストリーミングすることで非公開プロジェクトのアセットも保護する。`/live`はWorkerが認証・可視性判定した後にDurable Objectへ接続をハンドオフする（DO自体はAccess/Bearerを意識しない）。ingest時にWorkerが書き込むデータ種別（metrics/media/logs）を問わず、同じDOインスタンスへ通知してfan-outする。

## 6. フロントエンド構成

- `/` — 閲覧可能なプロジェクト一覧（公開は常時、非公開はログイン時のみ表示）
- `/projects/:project_id` — プロジェクト内のjob一覧（正規URL）
- `/projects/:project_id/jobs/:job_id` — run詳細（config、ステータス、Rechartsでのメトリクスグラフ、画像ギャラリー、音声プレイヤー、ログビューア）（正規URL）
- `/users` — チームメンバー一覧（アバター・表示名）
- `/users/:handle` — マイページ／他ユーザーのプロフィール（表示名・アバター）。そのユーザーが所有するプロジェクトの一覧を表示し、各項目は`/projects/:project_id`にリンクする（jobやmetricsへの専用URLはここには持たせない）
- `/settings/profile` — 表示名・URL用handle・アバターの編集
- `/settings/tokens` — アクセストークン管理
- `/admin` — ユーザー・ロール管理
- `/setup` — 初期セットアップ

UIはshadcn/uiベースのフラットデザインに統一。PWAはvite-plugin-pwaで最低限のmanifest（`display: "fullscreen"`または`"standalone"`、アイコン）のみ用意し、オフラインキャッシュ等の高度な機能は実装しない。

SPAなのでSlack等でのリンク展開（OGP）に対応するには、静的な`index.html`だけでは`og:title`等が固定になってしまう。`/projects/:project_id`・`/projects/:project_id/jobs/:job_id`・`/users/:handle`へのアクセス時はWorkerがHTMLレスポンスを生成する際に`projects.name`・`users.display_name`（・`avatar_key`があれば`og:image`）をD1から引いて`<meta>`タグに埋め込む。

## 7. Python SDK（要件15）

```python
import atmos as wb

run = wb.init(project="my-project", name="exp1", config={"lr": 1e-3})
run.log({"loss": 0.1, "acc": 0.95}, step=1)
run.log_image("sample", "path/to/img.png", step=1)
run.log_audio("sample", "path/to/audio.wav", step=1)
run.log_text("epoch 1 done")

import logging
logging.getLogger().addHandler(run.log_handler())  # 標準loggingの出力もログとして送信

run.finish()
```

- 接続先・トークンは環境変数（`ATMOS_API_URL` / `ATMOS_TOKEN`）または`wb.init()`引数で指定。
- `log()`・`log_text()`は内部バッファに溜め、一定間隔・件数でバッチ送信（リアルタイム性が不要なため、シンプルな時間駆動フラッシュで十分）。
- ログはv1では明示送信（`log_text()`）と、標準`logging`モジュール向けハンドラ（`run.log_handler()`）の提供に留める。標準出力/標準エラーの自動キャプチャ（`sys.stdout`のtee、`tqdm`等の`\r`出力への対応、マルチプロセス対応など）はwandb SDK互換モードと同様に実装コストが大きいため、v2以降に見送る。
- パッケージ名は `atmos`。社内配布のみであれば公開PyPIには出さず、wheel配布 or git経由インストールで問題ない。

## 8. リポジトリ構成案

```
atmos/
├── apps/
│   └── web/                 # フロントエンド + Worker（同一Workerでホスティング）
│       ├── src/
│       │   ├── api/         # Hono API（projects / admin / setup）+ Durable Object（job単位のライブ配信チャネル、WebSocket Hibernation）
│       │   ├── app/         # React SPA
│       │   └── db/          # Drizzle schema + migrations
│       ├── wrangler.toml
│       └── vite.config.ts
├── packages/
│   └── python-sdk/          # atmos
│       ├── src/atmos/
│       └── pyproject.toml
└── PLAN.md
```

## 9. v1スコープまとめ

**含む**: 要件1〜15すべて（アカウント管理、公開/非公開プロジェクト、job管理、Cloudflare Access連携、アクセストークンIssue/Revoke、メトリクス＋画像/音声、Cloudflare Workers+R2ホスティング、Recharts表示、最低限PWA、Vite+TS+React+shadcn、初回セットアップ、Python SDK）、Durable Objects（WebSocket Hibernation API）によるチャートのリアルタイム自動更新

**含まない（v2以降）**:
- wandb Python SDK互換モード（要件16）— 本家wandbはGraphQL APIや署名付きアップロードなど内部実装が複雑なため、後回し
- 標準出力/標準エラーの自動キャプチャ（`sys.stdout`のtee等）— v1は`log_text()`・`logging`ハンドラのみ
- 複数run比較・グルーピング・Sweep相当機能

## 10. 未決事項（実装着手前に決めたいこと）

- Cloudflare Accessのアプリケーション設定（ドメイン、ポリシー）は誰がどう用意するか
- SDKの`wb.init(project="...")`が何をキーにプロジェクトを検索/作成するか（`projects.name`は一意でないため）
