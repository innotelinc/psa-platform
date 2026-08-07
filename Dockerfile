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

# Server code + production deps only
COPY server/package.json server/package-lock.json* ./server/
RUN npm --prefix server ci --omit=dev --no-audit --no-fund

COPY server/ ./server/

# Built frontend → served by Express as static files
COPY --from=builder /app/client/dist/ ./server/public/

# Data directory for JSON persistence (optional volume mount point)
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data

USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/oauth/status',r=>{process.exit(r.statusCode===200?0:1)})"

CMD ["node", "server/index.js"]
