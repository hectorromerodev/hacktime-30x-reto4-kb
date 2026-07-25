import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const aqui = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  // Necesario para el Dockerfile: genera un bundle autocontenido.
  output: 'standalone',

  // Se fija la raiz del monorepo a mano. Sin esto Next la infiere, y la
  // inferencia cambia entre el host y la imagen de Docker: el mismo build
  // dejaba `server.js` en `apps/web/` afuera y en la raiz adentro, lo que
  // rompia el CMD del contenedor. Fijandola, la ruta es siempre
  // `.next/standalone/apps/web/server.js`.
  outputFileTracingRoot: path.join(aqui, '../../'),

  // El paquete core es TypeScript sin compilar; Next lo transpila.
  transpilePackages: ['@conteo/core'],

  // Next 16 quito la clave `eslint` de la config (el lint salio del build).
  // El chequeo de tipos SI corre en el build, a proposito: preferimos que
  // falle aqui y no en produccion.
  typescript: { ignoreBuildErrors: false },

  /**
   * Despliegue partido (web en Vercel, API en Render): se reenvia /api/* al
   * origen de la API.
   *
   * No es una comodidad, es lo que hace viable la sesion. Con dominios
   * distintos la cookie seria de terceros y habria que ponerla en
   * SameSite=None — justo lo que los navegadores estan restringiendo. Con el
   * rewrite, el navegador solo ve un origen, igual que en Docker detras de
   * Caddy: misma cookie, sin CORS y un solo scope para el service worker.
   *
   * En Docker esta variable NO se define, porque de eso ya se encarga Caddy.
   */
  async rewrites() {
    const api = process.env.ORIGEN_API_INTERNO;
    if (!api) return [];
    return [{ source: '/api/:ruta*', destination: `${api.replace(/\/$/, '')}/:ruta*` }];
  },
};

export default config;
