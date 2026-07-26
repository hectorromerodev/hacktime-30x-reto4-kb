/**
 * Evidencia fotográfica de la merma.
 *
 * La foto se sube por separado de la captura, a propósito: el conteo funciona
 * sin conexión y una imagen no cabe cómodamente en el lote de sincronización.
 * El dispositivo la guarda localmente, la sube cuando hay red, y la captura
 * viaja con la URL resultante.
 *
 * Se recibe como JSON con la imagen en base64 en vez de multipart: son unos
 * pocos cientos de kilobytes ya comprimidos por el navegador, y evita meter
 * una dependencia de parseo de formularios solo para esto.
 */

import type { FastifyInstance } from 'fastify';
import { requiereSesion } from '../auth.ts';
import { guardarFoto, leerFoto, usaSpaces, MAX_BYTES } from '../almacen.ts';

const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function rutasEvidencia(app: FastifyInstance) {
  /** Dónde acaban las fotos. Útil para diagnosticar un despliegue. */
  app.get('/evidencia/destino', async () => ({
    destino: usaSpaces ? 'spaces' : 'base',
    maxBytes: MAX_BYTES,
  }));

  app.post<{ Body: { clientId?: string; tipoContenido?: string; datos?: string } }>(
    '/evidencia',
    { preHandler: requiereSesion },
    async (req, reply) => {
      const { clientId, tipoContenido, datos } = req.body ?? {};

      if (!clientId || !datos) {
        return reply.code(400).send({ error: 'Faltan clientId o datos.' });
      }
      const tipo = tipoContenido ?? 'image/jpeg';
      if (!TIPOS_PERMITIDOS.has(tipo)) {
        return reply.code(415).send({ error: `Tipo no admitido: ${tipo}` });
      }

      // Se acepta con o sin el prefijo `data:image/...;base64,`.
      const limpio = datos.includes(',') ? datos.slice(datos.indexOf(',') + 1) : datos;
      let bytes: Buffer;
      try {
        bytes = Buffer.from(limpio, 'base64');
      } catch {
        return reply.code(400).send({ error: 'La imagen no es base64 válido.' });
      }
      if (bytes.byteLength === 0) {
        return reply.code(400).send({ error: 'La imagen llegó vacía.' });
      }

      try {
        const guardada = await guardarFoto(bytes, tipo, clientId);
        return { url: guardada.url, destino: guardada.destino, bytes: bytes.byteLength };
      } catch (e) {
        req.log.error(e);
        return reply
          .code(400)
          .send({ error: e instanceof Error ? e.message : 'No se pudo guardar la imagen.' });
      }
    },
  );

  /**
   * Sirve la foto cuando está en la base. Con Spaces la entrega el CDN y esta
   * ruta no se usa, pero se deja para que el modo sin credenciales funcione
   * igual de bien.
   */
  app.get<{ Params: { clientId: string } }>('/evidencia/:clientId', async (req, reply) => {
    const foto = await leerFoto(req.params.clientId);
    if (!foto) return reply.code(404).send({ error: 'No hay evidencia para esa captura.' });
    return reply
      .header('content-type', foto.tipoContenido)
      .header('cache-control', 'private, max-age=86400')
      .send(foto.datos);
  });
}
