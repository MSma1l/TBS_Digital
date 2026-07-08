# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Frontend (Next.js 16, App Router) — multi-stage build to a standalone image.
#
# NEXT_PUBLIC_* vars are inlined into the CLIENT bundle at BUILD time, so the
# API URL must be provided as a build ARG (not just a runtime env var) or the
# browser bundle will point at the wrong host.
# ---------------------------------------------------------------------------

# ---- Stage 1: install dependencies (cached on package*.json) --------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build the standalone output ---------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Baked into the client bundle — must be present during `next build`.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure public/ exists so the runtime COPY below always succeeds, even though
# this project ships no static assets today.
RUN npm run build && mkdir -p /app/public

# ---- Stage 3: minimal runtime (standalone server only) --------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# The standalone bundle: a self-contained server.js + traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets are NOT bundled into standalone — copy them alongside server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public/ is guaranteed to exist (created in the builder stage above).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
