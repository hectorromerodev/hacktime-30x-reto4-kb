import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { prisma } from './db.ts';
import { rutasSesion } from './rutas/sesion.ts';
import { rutasCatalogo } from './rutas/catalogo.ts';
import { rutasCapturas } from './rutas/capturas.ts';
import { rutasExportacion } from './rutas/exportacion.ts';
import { rutasEvidencia } from './rutas/evidencia.ts';

/**
 * Construye la aplicacion sin arrancarla.
 *
 * Separado de `index.ts` para poder probarla con `app.inject()`, que ejecuta
 * las rutas de verdad sin abrir un puerto. Es lo que permite que la prueba del
 * conteo ciego valga: recorre el mismo codigo que produccion.
 */
export async function crearApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    // Lotes de sincronizacion tras horas sin red pueden ser grandes, y las
    // fotos de evidencia viajan en base64 (~33% mas que los bytes crudos).
    bodyLimit: 12 * 1024 * 1024,
  });

  await app.register(cookie);
  await app.register(cors, {
    // En Docker todo sale por el mismo origen via Caddy y esto no se usa.
    // Sirve para desarrollo local (web en :3000, api en :4000) y para el
    // despliegue partido (web en Vercel, api en Render).
    origin: (process.env.ORIGEN_WEB ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  app.get('/salud', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, servicio: 'api-conteo', hora: new Date().toISOString() };
  });

  await app.register(rutasSesion);
  await app.register(rutasCatalogo);
  await app.register(rutasCapturas);
  await app.register(rutasExportacion);
  await app.register(rutasEvidencia);

  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error);
    reply.code(error.statusCode ?? 500).send({
      error: error.statusCode && error.statusCode < 500 ? error.message : 'Error interno.',
    });
  });

  return app;
}
