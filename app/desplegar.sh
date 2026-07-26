#!/usr/bin/env bash
#
# Despliega a producción: la web a Vercel y la API a Render.
#
#   ./desplegar.sh          # las dos
#   ./desplegar.sh web      # solo el frontend
#   ./desplegar.sh api      # solo el backend
#
# Necesita VERCEL_TOKEN y RENDER_API_KEY. Se leen del .env si existe.
#
# Por qué existe este script y no basta `vercel deploy`:
#
#  · La web necesita dos variables horneadas EN EL BUILD
#    (NEXT_PUBLIC_API_URL y ORIGEN_API_INTERNO). Si se olvidan, el frontend
#    se publica apuntando a ninguna parte y el fallo no se ve hasta que
#    alguien intenta entrar.
#
#  · El auto-deploy de Render NO dispara: el servicio se creó por API contra
#    un repositorio público, así que GitHub no tiene webhook instalado. Sin
#    lanzarlo a mano, la web se actualiza y la API se queda vieja — y eso se
#    manifiesta como un 404 en rutas que sí están en el código.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ"

[ -f .env ] && set -a && . ./.env && set +a

API_URL="${API_URL_PUBLICA:-https://conteo-inventarios-api.onrender.com}"
SERVICIO_RENDER="${RENDER_SERVICE_ID:-srv-d9ifao37uimc73bgbotg}"
QUE="${1:-todo}"

desplegar_web() {
  : "${VERCEL_TOKEN:?Falta VERCEL_TOKEN}"
  echo "▸ Frontend → Vercel"
  npx --yes vercel@latest deploy --prod --yes \
    --token "$VERCEL_TOKEN" \
    --build-env NEXT_PUBLIC_API_URL=/api \
    --build-env ORIGEN_API_INTERNO="$API_URL" \
    | tail -3
}

desplegar_api() {
  : "${RENDER_API_KEY:?Falta RENDER_API_KEY}"
  echo "▸ Backend → Render"
  local dep
  dep=$(curl -s -X POST \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    "https://api.render.com/v1/services/$SERVICIO_RENDER/deploys" -d '{}' \
    | tr -d '\n' | grep -o '"id":"dep-[^"]*"' | head -1 | cut -d'"' -f4)

  [ -z "$dep" ] && { echo "  no se pudo lanzar el despliegue"; return 1; }
  echo "  despliegue $dep"

  # Se espera a que quede vivo: si se sale antes, no hay forma de saber si
  # la migración de base de datos se aplicó.
  for _ in $(seq 1 30); do
    local estado
    estado=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
      "https://api.render.com/v1/services/$SERVICIO_RENDER/deploys/$dep" \
      | tr -d '\n' | grep -o '"status":"[a-z_]*"' | head -1 | cut -d'"' -f4)
    echo "  [$(date +%H:%M:%S)] $estado"
    case "$estado" in
      live) return 0 ;;
      build_failed|update_failed|canceled) echo "  FALLÓ"; return 1 ;;
    esac
    sleep 20
  done
  echo "  agotado el tiempo de espera"
  return 1
}

verificar() {
  echo "▸ Verificación"
  local web api
  web=$(curl -s -o /dev/null -w '%{http_code}' https://conteo-inventarios.vercel.app/)
  api=$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/salud")
  echo "  web  $web"
  echo "  api  $api"
  [ "$web" = "200" ] && [ "$api" = "200" ] || { echo "  algo no responde"; return 1; }
  echo "  todo arriba"
}

case "$QUE" in
  web)  desplegar_web ;;
  api)  desplegar_api ;;
  todo) desplegar_web; desplegar_api ;;
  *)    echo "uso: ./desplegar.sh [web|api]"; exit 1 ;;
esac

verificar
