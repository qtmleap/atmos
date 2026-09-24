#!/bin/zsh
set -e

sudo chown -R $(whoami):$(whoami) apps/web/node_modules 2>/dev/null || true
sudo chown -R $(whoami):$(whoami) packages/python-sdk/.venv 2>/dev/null || true
# The uv feature installs as root before this script runs, leaving the
# uv-cache named volume root-owned; uv then fails with "Permission denied"
# on CACHEDIR.TAG the first time it runs as vscode.
sudo chown -R $(whoami):$(whoami) ~/.cache/uv 2>/dev/null || true

# Silence direnv output.
# In direnv 2.36+, DIRENV_LOG_FORMAT env var is ignored unless direnv.toml exists.
# See: https://github.com/direnv/direnv/issues/1418
mkdir -p ~/.config/direnv
cat > ~/.config/direnv/direnv.toml <<'EOF'
[global]
log_format = ""
hide_env_diff = true
EOF

(
  cd apps/web
  bun install --frozen-lockfile --ignore-scripts
  bunx --bun biome migrate --write

  # Playwright MCP drives a real Chromium, and neither the browser nor its system
  # libraries ship in the image, so the first `browser_navigate` fails with
  # `Browser "chromium" is not installed` until both are installed here. The MCP
  # server bundles its own Playwright build and expects a different Chromium
  # revision than the `playwright` devDependency, so the browser has to come from
  # the MCP CLI rather than `playwright install`.
  if [ -f ../../playwright-mcp.config.json ]; then
    bunx @playwright/mcp install-browser --with-deps chromium
  fi
)

# Install Python declared in .python-version / pyproject.toml, then sync deps.
# `uv sync` creates .venv if it does not exist yet.
(
  cd packages/python-sdk
  if [ -f pyproject.toml ]; then
    if [ -f uv.lock ]; then
      uv sync --frozen
    else
      uv sync
    fi
  fi
)
