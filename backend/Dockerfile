# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN npm install -g pnpm@10.6.5 --silent

WORKDIR /repo

# Workspace manifests first — changes here bust the install layer cache.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY backend/package.json  ./backend/
COPY frontend/package.json ./frontend/

# Full install (devDeps needed for tsc).
RUN pnpm install --frozen-lockfile

# Source
COPY backend/src          ./backend/src
COPY backend/tsconfig.json ./backend/tsconfig.json

# Compile TypeScript → dist/ (build script also copies src/assets → dist/assets).
RUN pnpm --filter vc-screener-backend run build

# Resolve production-only node_modules into a standalone directory.
# pnpm v10 requires --legacy unless inject-workspace-packages is enabled.
RUN pnpm --filter vc-screener-backend deploy --prod --legacy /app

# Overlay the compiled output into the deploy bundle.
RUN cp -r backend/dist /app/dist


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder --chown=app:app /app ./

USER app

ENV NODE_ENV=production

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e \
    "require('http').get('http://localhost:3001/health',r=>r.statusCode===200?process.exit(0):process.exit(1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
