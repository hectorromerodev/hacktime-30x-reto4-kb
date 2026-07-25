# API. Se construye desde la raiz de `app/` para poder copiar el workspace
# completo (la API depende de `packages/core` por enlace de workspace).
#
#   docker compose build api
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# ── Dependencias ────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
# --ignore-scripts no: Prisma necesita bajar sus motores nativos.
RUN pnpm install --frozen-lockfile --filter api... || pnpm install --filter api...

# ── Imagen final ────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/core packages/core
COPY apps/api apps/api

WORKDIR /app/apps/api
RUN pnpm exec prisma generate

# openssl lo necesitan los motores de Prisma en Alpine.
RUN apk add --no-cache openssl

EXPOSE 4000

# Al arrancar: aplica las migraciones pendientes, siembra si hace falta (el
# seed es idempotente, no duplica en reinicios) y levanta la API.
#
# `migrate deploy` y no `db push`: solo aplica las migraciones versionadas que
# estan en prisma/migrations, sin inferir cambios ni tocar nada que no este en
# el historial. Es lo que corresponde en produccion.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node --experimental-strip-types src/seed.ts && node --experimental-strip-types src/index.ts"]
