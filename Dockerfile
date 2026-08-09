# ── Stage 1: build the Vite frontend ──────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY client/package.json client/package-lock.json* ./client/
COPY client/tsconfig.json client/vite.config.ts client/index.html ./client/
COPY client/src/ ./client/src/
RUN npm --prefix client ci --no-audit --no-fund && \
    npm --prefix client run build

# ── Stage 2: slim production image ─────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Git metadata baked into the image (passed by scripts/deploy.sh or
# `docker compose build --build-arg ...`). Used by /health & /api/version
# so stale deployments are visible in the app banner.
ARG GIT_COMMIT=unknown
ARG GIT_DATE=
ARG GIT_DESCRIBE=
ARG BUILD_TIME=

# Server code + production deps only
COPY server/package.json server/package-lock.json* ./server/
RUN npm --prefix server ci --omit=dev --no-audit --no-fund

COPY server/ ./server/
# Bake build metadata (runs as root — before USER node). ARG values are exported
# to RUN shells, so process.env.GIT_COMMIT picks up the --build-arg. The preceding
# COPY invalidates this layer whenever sources change, so the baked commit is never stale.
RUN node -e "const fs=require('fs');fs.writeFileSync('/app/server/version.json',JSON.stringify({commit:process.env.GIT_COMMIT||'unknown',date:process.env.GIT_DATE||'',describe:process.env.GIT_DESCRIBE||'',buildTime:process.env.BUILD_TIME||new Date().toISOString(),source:'docker'}))"

# Built frontend → served by Express as static files
COPY --from=builder /app/client/dist/ ./server/public/

# Data directory for JSON persistence (optional volume mount point)
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data

USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV OAUTH_REDIRECT_BASE=https://psa.innotel.us

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health',r=>{process.exit(r.statusCode===200?0:1)})"

CMD ["node", "server/index.js"]
