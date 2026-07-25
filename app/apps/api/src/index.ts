import { prisma } from './db.ts';
import { crearApp } from './app.ts';

const PUERTO = Number(process.env.API_PORT ?? 4000);

const app = await crearApp();

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
