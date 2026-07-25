import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { prisma } from './db.ts';
import { rutasSesion } from './rutas/sesion.ts';
import { rutasCatalogo } from './rutas/catalogo.ts';
import { rutasCapturas } from './rutas/capturas.ts';
import { rutasExportacion } from './rutas/exportacion.ts';

const PUERTO = Number(process.env.API_PORT ?? 4000);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  // Lotes de sincronizacion tras horas sin red pueden ser grandes.
  bodyLimit: 8 * 1024 * 1024,
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

app.setErrorHandler((error, _req, reply) => {
  app.log.error(error);
  reply.code(error.statusCode ?? 500).send({
    error: error.statusCode && error.statusCode < 500 ? error.message : 'Error interno.',
  });
});

try {
  await app.listen({ port: PUERTO, host: '0.0.0.0' });
  app.log.info(`API escuchando en :${PUERTO}`);
} catch (e) {
  app.log.error(e);
  process.exit(1);
}

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
