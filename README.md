# atmos

wandb の代わりに使う、小さなチーム向けの実験管理ツール。学習ジョブから送ったメトリクス・画像・音声・ログをブラウザで見る。ジョブの実行中はチャートが自動で更新される。

全体を Cloudflare Workers の上で動かす。

- API とフロントエンドの配信: Workers（Hono）と Workers Assets
- メタデータとメトリクス: D1
- 画像と音声: R2
- 実行中ジョブのライブ配信: Durable Object（`JobLive`、ジョブごとに一つ）
- ブラウザのログイン: Cloudflare Access
- SDK からの送信: ユーザーごとのアクセストークン（Bearer）

設計の詳細は `docs/` にある。

| 文書 | 内容 |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | 構成、データモデル、画面、認証の方針 |
| [docs/SPEC.md](docs/SPEC.md) | API のリクエストとレスポンスの型 |
| [docs/SCHEMA.md](docs/SCHEMA.md) | D1 のテーブル定義 |
| `docs/mock-diff/` | 画面のモック HTML（実装との突き合わせに使う） |

## リポジトリの構成

| 場所 | 中身 |
|---|---|
| `apps/web` | Worker 本体。`src/api` がサーバ、`src/app` が React の SPA（TanStack Router、Intlayer、shadcn/ui）、`src/db` がスキーマと移行 |
| `packages/python-sdk` | 学習コードから使う Python SDK。使い方は [packages/python-sdk/README.md](packages/python-sdk/README.md) |
| `docs` | 計画書、API 仕様、画面モック |
| `.devcontainer` | 開発環境。Bun、Node.js、uv が入る |

## 開発

devcontainer で開く前提。`apps/web/biome-plugins` はサブモジュールなので、手元で clone したときは取り込んでおく。

```sh
git submodule update --init --recursive
```

### apps/web

依存の一つ `@qtmleap/vite-plugin-mock-diff` は GitHub Packages の非公開パッケージで、`GITHUB_TOKEN`（`read:packages` 権限）が要る。

```sh
cd apps/web
bun install
bun run dev         # Vite の開発サーバ
bun run test        # テスト
bun run typecheck   # 型検査
bun run lint        # Biome
bun run build       # 本番ビルド
bun run cf-typegen  # wrangler.toml から Worker の型を生成
```

ローカル用の秘密値（`INIT_ADMIN_KEY` など）は `apps/web/.dev.vars` に置く。このファイルはコミットしない。

### packages/python-sdk

```sh
cd packages/python-sdk
uv sync
uv run pytest
uv run mypy .
uvx ruff check
uvx ruff format --check
```

## Cloudflare の資源

環境は staging と production の二つ。どちらも `apps/web/wrangler.toml` に定義してある。

| 環境 | ドメイン | Worker | D1 | R2 |
|---|---|---|---|---|
| staging | `atmos-staging.qleap.jp` | `atmos-web-staging` | `atmos-staging` | `atmos-assets-staging` |
| production | `atmos.qleap.jp` | `atmos-web` | `atmos` | `atmos-assets` |

`*.workers.dev` とプレビュー URL は無効にしてある。Cloudflare Access の外に入口を作らないため。

### D1 の移行

移行ファイルは `apps/web/src/db/migrations` に平置きの `.sql` で置く。適用は環境ごとに行う。

```sh
cd apps/web
bunx wrangler d1 migrations apply DB --env staging --remote
bunx wrangler d1 migrations apply DB --env production --remote
```

### 秘密値

`INIT_ADMIN_KEY`（最初の管理者を作るときの鍵）は必須で、無いとデプロイできない。環境ごとに設定する。

```sh
bunx wrangler secret put INIT_ADMIN_KEY --env staging
bunx wrangler secret put INIT_ADMIN_KEY --env production
```

## ブランチと CI

作業は機能ブランチで行い、`develop` へ PR を出す。`develop` から `master` への PR がリリースになる。

| ワークフロー | 動く時機 | 内容 |
|---|---|---|
| Integration | push と PR | commitlint、Biome、型検査、ビルド、テスト（web と SDK の両方） |
| Deploy to Cloudflare Workers | PR のマージ時 | `develop` へのマージは staging、`master` へのマージは production にデプロイ |
| Update Dependencies | 毎週月曜 | 依存を更新して PR を作る |

ランナーはすべて self-hosted。デプロイには `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` の二つのシークレットが要る。

コミットメッセージは Conventional Commits に従う（`.commitlintrc.yaml`）。
