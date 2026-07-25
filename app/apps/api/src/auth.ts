/**
 * Autenticacion minima: seleccionar usuario de una lista + PIN de 4 digitos.
 *
 * Es deliberado. La tablet es un dispositivo compartido de bodega, no una app
 * publica: lo unico que la auditoria necesita es poder atribuir cada captura a
 * una persona. Un flujo de registro/recuperacion no aportaria nada al reto y si
 * consumiria horas. Queda dicho en el README para que no se lea como descuido.
 */

import jwt from 'jsonwebtoken';
import type { FastifyReply, FastifyRequest } from 'fastify';

const SECRETO = process.env.JWT_SECRET ?? 'secreto-de-desarrollo';
export const COOKIE = 'conteo_sesion';

export interface Sesion {
  usuarioId: string;
  nombre: string;
  rol: 'CONTADOR' | 'LIDER';
}

export function firmar(sesion: Sesion): string {
  return jwt.sign(sesion, SECRETO, { expiresIn: '30d' });
}

export function verificar(token: string): Sesion | null {
  try {
    return jwt.verify(token, SECRETO) as Sesion;
  } catch {
    return null;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    sesion?: Sesion;
  }
}

/** preHandler: exige sesion valida. */
export async function requiereSesion(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies?.[COOKIE] ?? extraerBearer(req);
  const sesion = token ? verificar(token) : null;
  if (!sesion) {
    return reply.code(401).send({ error: 'Sesion no valida. Vuelve a ingresar con tu PIN.' });
  }
  req.sesion = sesion;
}

/** preHandler: exige rol de lider (cierre de conteo, exportacion, conflictos). */
export async function requiereLider(req: FastifyRequest, reply: FastifyReply) {
  await requiereSesion(req, reply);
  if (reply.sent) return;
  if (req.sesion?.rol !== 'LIDER') {
    return reply.code(403).send({ error: 'Esta accion es solo del lider de costos.' });
  }
}

/** Las tablets guardan cookie; el modo quiosco a veces no. Se acepta Bearer. */
function extraerBearer(req: FastifyRequest): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
