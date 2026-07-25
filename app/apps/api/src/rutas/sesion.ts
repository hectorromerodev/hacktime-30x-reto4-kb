import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.ts';
import { COOKIE, firmar, requiereSesion } from '../auth.ts';

/**
 * Atributos de la cookie de sesión. Se comparten entre crear y borrar: si no
 * coinciden, el navegador ignora el borrado.
 */
const OPCIONES_COOKIE = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
} as const;

export async function rutasSesion(app: FastifyInstance) {
  /** Lista para el selector de ingreso. Nunca devuelve el PIN. */
  app.get('/usuarios', async () => {
    const usuarios = await prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, rol: true },
      orderBy: { nombre: 'asc' },
    });
    return { usuarios };
  });

  app.post<{ Body: { usuarioId?: string; pin?: string } }>('/auth/login', async (req, reply) => {
    const { usuarioId, pin } = req.body ?? {};
    if (!usuarioId || !pin) {
      return reply.code(400).send({ error: 'Faltan usuario o PIN.' });
    }

    const usuario = await prisma.usuario.findFirst({
      where: { id: usuarioId, activo: true },
    });
    if (!usuario || usuario.pin !== pin) {
      return reply.code(401).send({ error: 'PIN incorrecto.' });
    }

    const sesion = {
      usuarioId: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol as 'CONTADOR' | 'LIDER',
    };

    reply.setCookie(COOKIE, firmar(sesion), { ...OPCIONES_COOKIE, maxAge: 60 * 60 * 24 * 30 });

    return { usuario: sesion };
  });

  app.post('/auth/logout', async (_req, reply) => {
    // Se borra con LOS MISMOS atributos con los que se creó.
    //
    // Antes solo se pasaba `path`, y el botón Salir no hacía nada en
    // producción: la cookie se crea con `Secure`, y los navegadores no dejan
    // que una cookie NO segura sobrescriba una segura. La instrucción de
    // borrado se descartaba en silencio y la sesión seguía viva.
    reply.clearCookie(COOKIE, OPCIONES_COOKIE);
    return { ok: true };
  });

  app.get('/auth/yo', { preHandler: requiereSesion }, async (req) => ({
    usuario: req.sesion,
  }));
}
