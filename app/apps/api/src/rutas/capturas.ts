/**
 * Sincronizacion de capturas.
 *
 * Contrato: el dispositivo genera un `clientId` (UUID) ANTES de tener red y lo
 * manda en cada lote. El servidor inserta por `clientId`; reenviar el mismo
 * lote no duplica nada. Reintentar es gratis, que es exactamente lo que se
 * necesita cuando la tablet recupera senal a mitad de un almacen.
 *
 * Aqui tambien vive la regla R8 (salto de orden de magnitud) evaluada contra
 * `sd`, y la deteccion de conteos simultaneos entre contadores.
 */

import type { FastifyInstance } from 'fastify';
import { prisma, aNumero } from '../db.ts';
import { requiereSesion } from '../auth.ts';
import { ordenDeMagnitud, calcularExp10 } from '@conteo/core';

interface CapturaEntrante {
  clientId: string;
  articuloId: string;
  cantidad: number;
  unidad: string;
  unidadDicha?: string | null;
  metodo: 'VOZ' | 'TECLADO' | 'CAMARA' | 'BUSQUEDA';
  textoCrudo?: string | null;
  scoreMatch?: number | null;
  anomalias?: string[];
  motivoConfirmacion?: string | null;
  capturadoEn: string;
  deviceId?: string | null;
  /** El contador declaro que es un recuento: reemplaza lo anterior. */
  reemplaza?: boolean;
}

const METODOS = new Set(['VOZ', 'TECLADO', 'CAMARA', 'BUSQUEDA']);

export async function rutasCapturas(app: FastifyInstance) {
  app.addHook('preHandler', requiereSesion);

  app.post<{ Params: { id: string }; Body: { capturas?: CapturaEntrante[] } }>(
    '/conteos/:id/capturas',
    async (req, reply) => {
      const conteoId = req.params.id;
      const entrantes = req.body?.capturas ?? [];
      if (!Array.isArray(entrantes) || entrantes.length === 0) {
        return reply.code(400).send({ error: 'El lote viene vacio.' });
      }
      if (entrantes.length > 500) {
        return reply.code(413).send({ error: 'Lote demasiado grande (max 500).' });
      }

      const conteo = await prisma.conteo.findUnique({
        where: { id: conteoId },
        select: { id: true, bodegaId: true, estado: true },
      });
      if (!conteo) return reply.code(404).send({ error: 'Conteo no encontrado.' });
      if (conteo.estado !== 'ABIERTO') {
        return reply.code(409).send({ error: 'El conteo ya fue cerrado.' });
      }

      const usuarioId = req.sesion!.usuarioId;

      // Se resuelve todo lo consultable de una vez, no por captura.
      const idsArticulo = [...new Set(entrantes.map((c) => c.articuloId))];
      const [stocks, previas, yaExistentes] = await Promise.all([
        prisma.stock.findMany({
          where: { bodegaId: conteo.bodegaId, articuloId: { in: idsArticulo } },
          select: { articuloId: true, sd: true, articulo: { select: { unidad: true, nombre: true } } },
        }),
        prisma.captura.findMany({
          where: { conteoId, articuloId: { in: idsArticulo }, estado: 'ACTIVA' },
          select: { id: true, articuloId: true, usuarioId: true, usuario: { select: { nombre: true } } },
        }),
        prisma.captura.findMany({
          where: { clientId: { in: entrantes.map((c) => c.clientId) } },
          select: { clientId: true },
        }),
      ]);

      const porArticulo = new Map(stocks.map((s) => [s.articuloId, s]));
      const previasPorArticulo = new Map<string, typeof previas>();
      for (const p of previas) {
        const lista = previasPorArticulo.get(p.articuloId) ?? [];
        lista.push(p);
        previasPorArticulo.set(p.articuloId, lista);
      }
      const duplicadas = new Set(yaExistentes.map((c) => c.clientId));

      const aceptadas: string[] = [];
      const rechazadas: { clientId: string; motivo: string }[] = [];
      const conflictos: { clientId: string; articuloId: string; otroContador: string }[] = [];
      const verificar: { clientId: string; articuloId: string; mensaje: string }[] = [];
      const aReemplazar: string[] = [];

      const filas: Parameters<typeof prisma.captura.createMany>[0]['data'] = [];

      for (const c of entrantes) {
        if (!c.clientId || !c.articuloId) {
          rechazadas.push({ clientId: c.clientId ?? '(sin id)', motivo: 'faltan campos' });
          continue;
        }
        // Idempotencia: ya la teniamos. El cliente igual debe sacarla del outbox.
        if (duplicadas.has(c.clientId)) continue;

        const stock = porArticulo.get(c.articuloId);
        if (!stock) {
          rechazadas.push({ clientId: c.clientId, motivo: 'el articulo no pertenece a esta bodega' });
          continue;
        }
        if (!Number.isFinite(c.cantidad) || c.cantidad < 0) {
          rechazadas.push({ clientId: c.clientId, motivo: 'cantidad invalida' });
          continue;
        }
        if (!METODOS.has(c.metodo)) {
          rechazadas.push({ clientId: c.clientId, motivo: 'metodo invalido' });
          continue;
        }

        // ── Conteo simultaneo entre personas distintas ──────────────────
        // Nunca se suma en silencio: el proceso real tiene alguien que cuenta
        // y alguien que recuenta, y confundir recuento con suma duplicaria
        // inventario. Se marca y el lider decide.
        const otras = previasPorArticulo.get(c.articuloId) ?? [];
        const deOtro = otras.find((p) => p.usuarioId !== usuarioId);
        const mia = otras.find((p) => p.usuarioId === usuarioId);

        let enConflicto = false;
        if (deOtro) {
          enConflicto = true;
          conflictos.push({
            clientId: c.clientId,
            articuloId: c.articuloId,
            otroContador: deOtro.usuario.nombre,
          });
        }
        // Recuento propio: la anterior queda reemplazada, gana la ultima.
        if (mia && c.reemplaza) aReemplazar.push(mia.id);

        // ── R8, del lado del servidor ───────────────────────────────────
        // Se evalua aqui contra `sd` real. La respuesta describe la ESCALA,
        // nunca el valor esperado.
        const sd = aNumero(stock.sd);
        const exp10 = calcularExp10(sd);
        const orden = ordenDeMagnitud(c.cantidad);
        if (exp10 !== null && orden !== null && Math.abs(orden - exp10) >= 1 && c.cantidad > 0) {
          verificar.push({
            clientId: c.clientId,
            articuloId: c.articuloId,
            mensaje:
              `${stock.articulo.nombre.trim()} quedo fuera de la escala habitual ` +
              'en esta bodega. Conviene recontarlo.',
          });
        }

        filas.push({
          clientId: c.clientId,
          conteoId,
          articuloId: c.articuloId,
          cantidad: c.cantidad,
          unidad: c.unidad || stock.articulo.unidad,
          unidadDicha: c.unidadDicha ?? null,
          metodo: c.metodo,
          textoCrudo: c.textoCrudo ?? null,
          scoreMatch: c.scoreMatch ?? null,
          anomalias: (c.anomalias ?? []) as never,
          motivoConfirmacion: c.motivoConfirmacion ?? null,
          usuarioId,
          deviceId: c.deviceId ?? null,
          capturadoEn: new Date(c.capturadoEn ?? Date.now()),
          enConflicto,
          revision: mia && c.reemplaza ? 2 : 1,
          reemplazaA: mia && c.reemplaza ? mia.id : null,
        });

        aceptadas.push(c.clientId);
      }

      if (filas.length > 0) {
        await prisma.$transaction([
          // `skipDuplicates` cierra la ventana de carrera entre dos lotes
          // simultaneos con el mismo clientId.
          prisma.captura.createMany({ data: filas, skipDuplicates: true }),
          ...(aReemplazar.length
            ? [
                prisma.captura.updateMany({
                  where: { id: { in: aReemplazar } },
                  data: { estado: 'REEMPLAZADA' },
                }),
              ]
            : []),
        ]);

        await prisma.conteoParticipante.upsert({
          where: { conteoId_usuarioId: { conteoId, usuarioId } },
          create: { conteoId, usuarioId, rol: req.sesion!.rol },
          update: {},
        });
      }

      return {
        aceptadas,
        // El cliente saca del outbox tanto aceptadas como duplicadas.
        duplicadas: [...duplicadas],
        rechazadas,
        conflictos,
        verificar,
        servidorEn: new Date().toISOString(),
      };
    },
  );

  /**
   * SOLO las capturas del usuario que pide, para poder retomar el conteo en
   * otra tablet sin perder lo propio.
   *
   * Es una ruta aparte y no un parametro de la anterior a proposito: filtrar
   * por `usuarioId` no puede depender de que nadie olvide pasar una bandera.
   * El conteo es ciego TAMBIEN entre contadores — uno cuenta y otro recuenta
   * sin ver el resultado del primero, que es el control de auditoria — asi que
   * esta ruta jamas debe devolver lo de otra persona.
   */
  app.get<{ Params: { id: string } }>('/conteos/:id/capturas/mias', async (req) => {
    const capturas = await prisma.captura.findMany({
      where: {
        conteoId: req.params.id,
        usuarioId: req.sesion!.usuarioId,
        estado: 'ACTIVA',
      },
      select: {
        clientId: true,
        articuloId: true,
        cantidad: true,
        unidad: true,
        unidadDicha: true,
        metodo: true,
        textoCrudo: true,
        scoreMatch: true,
        anomalias: true,
        motivoConfirmacion: true,
        enConflicto: true,
        capturadoEn: true,
        articulo: { select: { nombre: true } },
      },
      orderBy: { capturadoEn: 'asc' },
    });

    return {
      capturas: capturas.map((c) => ({
        clientId: c.clientId,
        articuloId: c.articuloId,
        articuloNombre: c.articulo.nombre.trim(),
        cantidad: aNumero(c.cantidad),
        unidad: c.unidad,
        unidadDicha: c.unidadDicha,
        metodo: c.metodo,
        textoCrudo: c.textoCrudo,
        scoreMatch: c.scoreMatch,
        anomalias: c.anomalias,
        motivoConfirmacion: c.motivoConfirmacion,
        enConflicto: c.enConflicto,
        capturadoEn: c.capturadoEn.toISOString(),
      })),
    };
  });

  /** Lo capturado hasta ahora. Alimenta la vista del lider. */
  app.get<{ Params: { id: string } }>('/conteos/:id/capturas', async (req) => {
    const capturas = await prisma.captura.findMany({
      where: { conteoId: req.params.id, estado: 'ACTIVA' },
      select: {
        clientId: true,
        articuloId: true,
        cantidad: true,
        unidad: true,
        metodo: true,
        textoCrudo: true,
        anomalias: true,
        enConflicto: true,
        capturadoEn: true,
        usuario: { select: { id: true, nombre: true } },
        articulo: { select: { nombre: true, unidad: true } },
      },
      orderBy: { recibidoEn: 'desc' },
    });

    return {
      capturas: capturas.map((c) => ({
        clientId: c.clientId,
        articuloId: c.articuloId,
        articulo: c.articulo.nombre.trim(),
        cantidad: aNumero(c.cantidad),
        unidad: c.unidad,
        metodo: c.metodo,
        textoCrudo: c.textoCrudo,
        anomalias: c.anomalias,
        enConflicto: c.enConflicto,
        capturadoEn: c.capturadoEn,
        usuario: c.usuario,
      })),
    };
  });

  /** Anula una captura (correccion del contador o del lider). */
  app.delete<{ Params: { id: string; clientId: string } }>(
    '/conteos/:id/capturas/:clientId',
    async (req, reply) => {
      const captura = await prisma.captura.findUnique({
        where: { clientId: req.params.clientId },
        select: { id: true, conteoId: true, usuarioId: true },
      });
      if (!captura || captura.conteoId !== req.params.id) {
        return reply.code(404).send({ error: 'Captura no encontrada.' });
      }
      if (captura.usuarioId !== req.sesion!.usuarioId && req.sesion!.rol !== 'LIDER') {
        return reply.code(403).send({ error: 'Solo quien capturo o el lider puede anular.' });
      }
      await prisma.captura.update({
        where: { id: captura.id },
        data: { estado: 'ANULADA' },
      });
      return { ok: true };
    },
  );
}
