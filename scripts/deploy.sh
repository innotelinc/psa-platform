#!/usr/bin/env bash
# Rebuild & redeploy the Docker stack, baking the current git commit into the
# image so the app's build banner (/api/version, /health) reflects what is
# actually running — stale deployments become visible in the UI.
#
# Usage:  ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
GIT_DATE="$(git log -1 --format=%cI 2>/dev/null || true)"
GIT_DESCRIBE="$(git describe --tags --always --dirty 2>/dev/null || true)"

echo "🚀 Deploying commit ${GIT_COMMIT}${GIT_DESCRIBE:+ ($GIT_DESCRIBE)}"

docker compose build \
  --build-arg GIT_COMMIT="$GIT_COMMIT" \
  --build-arg GIT_DATE="$GIT_DATE" \
  --build-arg GIT_DESCRIBE="$GIT_DESCRIBE" \
  --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

docker compose up -d
echo "✅ Redeployed ${GIT_COMMIT}. Verify: curl http://localhost:3000/health"
