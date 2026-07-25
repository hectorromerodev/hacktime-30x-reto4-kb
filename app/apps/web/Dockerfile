# Web (Next.js).
#
# El contexto de build es la RAIZ DEL REPOSITORIO, igual que el de la API, para
# que ambos servicios se construyan con el mismo contexto y un solo
# .dockerignore.
#
#   docker compose build web
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# ── Dependencias ────────────────────────────────────────────────────────
FROM base AS deps
COPY app/package.json app/pnpm-workspace.yaml app/pnpm-lock.yaml* ./
COPY app/packages/core/package.json packages/core/
COPY app/apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web... || pnpm install --filter web...

# ── Compilacion ─────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY app/package.json app/pnpm-workspace.yaml ./
COPY app/packages/core packages/core
COPY app/apps/web apps/web

# La URL de la API se hornea en el bundle del cliente. Por defecto '/api',
# que es el mismo origen servido por Caddy: sin CORS y con el service worker
# bajo un solo scope.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/web
RUN pnpm build

# ── Imagen final ────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# `output: standalone` produce un bundle autocontenido: la imagen final no
# necesita node_modules ni el workspace.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
