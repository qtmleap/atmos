# syntax=docker/dockerfile:1

# Self-hosted image: Bun + PostgreSQL + a local directory, built and run by
# src/server/ (src/server/index.ts is the entry point; see its header comment
# for the startup sequence). This is a second way to run the same app —
# src/api/index.ts and wrangler.toml (Cloudflare Workers) are untouched by
# this file and keep deploying exactly as before.
#
# apps/web is a self-contained package (its own package.json/bun.lock, no
# workspace root), so the build context is this directory: `docker build -f
# apps/web/Dockerfile apps/web`, or `docker compose -f apps/web/compose.yaml
# build` (compose.yaml already sets `context: .` relative to itself).
#
# The build stage produces two bundles:
#   - dist/client: the SPA, `vite build`'s ordinary output — the same bytes
#     the Cloudflare Workers ASSETS binding would serve, read here by
#     src/server/static.ts instead. `@cloudflare/vite-plugin` stays in
#     vite.config.ts (it also drives `vite`'s dev server) and additionally
#     emits a Workers bundle alongside dist/client; that second bundle is
#     simply never copied into the runtime stage.
#   - dist/server: src/server/index.ts, bundled for Bun with
#     `--conditions=postgres` so every `#schema` import resolves to
#     src/db/pg/schema.ts instead of the D1 (SQLite) one (package.json
#     "imports").
#
# `bun run build`'s `tsc -b --noEmit` step is intentionally not run here: it
# additionally requires worker-configuration.d.ts, a `wrangler types` output
# that is gitignored and Cloudflare-specific, and typechecking is a CI
# concern, not something an image build should repeat.
FROM oven/bun:1.4.2 AS build
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
# @qtmleap/vite-plugin-mock-diff (devDependencies) is published to GitHub
# Packages, not the public npm registry (see bunfig.toml); `docker build
# --secret id=github_token,env=GITHUB_TOKEN` must supply a token with
# read:packages against qtmleap/mock-diff-viewer, the same one CI and local
# `bun install` already need (bunfig.toml's comment: CI's own GITHUB_TOKEN,
# `gh auth token` locally).
RUN --mount=type=secret,id=github_token,env=GITHUB_TOKEN \
    bun install --frozen-lockfile

COPY . .

RUN bunx vite build
RUN bun build src/server/index.ts --target=bun --conditions=postgres --outdir dist/server

# The runtime stage never sees devDependencies, source, or the Cloudflare
# Workers bundle vite build also produced — only the two bundles above and
# the PostgreSQL migrations they need at startup (migratePg, called from
# index.ts before Bun.serve).
FROM oven/bun:1.4.2-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist/client ./dist/client
COPY --from=build /app/dist/server ./dist/server
# migratePg's default migrationsFolder is `${import.meta.dir}/migrations`
# (src/db/pg/client.ts) — import.meta.dir of the *running* file, so once
# src/server/index.ts is bundled into dist/server/index.js this must resolve
# next to it, not next to the original source.
COPY --from=build /app/src/db/pg/migrations ./dist/server/migrations

# oven/bun images ship a non-root `bun` user (uid 1000) for exactly this.
USER bun

EXPOSE 8787

CMD ["bun", "dist/server/index.js"]
