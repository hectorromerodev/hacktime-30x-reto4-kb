# API.
#
# El contexto de build es la RAIZ DEL REPOSITORIO, no `app/`. Es a proposito:
# el seed necesita `datos/BODEGAS Y STOCK.xlsx`, que vive fuera de `app/`. En
# local eso se podria resolver con un volumen, pero en un host de contenedores
# (Render, Fly, Cloud Run) no hay volumen que montar y el seed fallaria. Con el
# contexto en la raiz, la imagen queda autocontenida y se despliega igual en
# cualquier lado.
#
#   docker compose build api
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# ── Dependencias ────────────────────────────────────────────────────────
FROM base AS deps
COPY app/package.json app/pnpm-workspace.yaml app/pnpm-lock.yaml* ./
COPY app/packages/core/package.json packages/core/
COPY app/apps/api/package.json apps/api/
# Sin --ignore-scripts: Prisma necesita bajar sus motores nativos.
RUN pnpm install --frozen-lockfile --filter api... || pnpm install --filter api...

# ── Imagen final ────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

# openssl lo necesitan los motores de Prisma en Alpine.
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY app/package.json app/pnpm-workspace.yaml ./
COPY app/packages/core packages/core
COPY app/apps/api apps/api

# El archivo de inventario que carga el seed.
COPY ["datos/BODEGAS Y STOCK.xlsx", "/datos/BODEGAS Y STOCK.xlsx"]
ENV RUTA_XLSX="/datos/BODEGAS Y STOCK.xlsx"

WORKDIR /app/apps/api
RUN pnpm exec prisma generate

EXPOSE 4000

# Al arrancar: aplica las migraciones pendientes, siembra si hace falta (el
# seed es idempotente, no duplica en reinicios) y levanta la API.
#
# `migrate deploy` y no `db push`: solo aplica las migraciones versionadas que
# estan en prisma/migrations, sin inferir cambios ni tocar nada que no este en
# el historial. Es lo que corresponde en produccion.
#
# Se invoca el binario DIRECTO, no `pnpm exec`: pnpm revalida el lockfile antes
# de ejecutar y, si algo no le cuadra, lanza un `pnpm install` completo dentro
# del contenedor ya construido. En un host con 512 MB eso agota la memoria y el
# arranque muere antes de abrir el puerto.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node --experimental-strip-types src/seed.ts && node --experimental-strip-types src/index.ts"]
