/**
 * Bodegas, conteos y catalogo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  EL PUNTO MAS DELICADO DEL SISTEMA ESTA EN ESTE ARCHIVO.
 *
 *  `GET /conteos/:id/catalogo` es lo unico que el dispositivo del contador
 *  descarga. Si `sd` se colara aqui, el conteo dejaria de ser ciego y se
 *  romperia el control de auditoria que Colsubsidio describio en vivo:
 *  "se hace de manera ciega para asegurar que la persona cuente realmente lo
 *   que hay, no lo que el sistema esta esperando".
 *
 *  Por eso el `select` es explicito (nunca `include`) y hay un test que falla
 *  si la respuesta contiene la clave `sd`.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { FastifyInstance } from 'fastify';
import { prisma, aNumero } from '../db.ts';
import { requiereSesion } from '../auth.ts';

export async function rutasCatalogo(app: FastifyInstance) {
  app.addHook('preHandler', requiereSesion);

  /** Bodegas. Se listan las 48 del archivo, marcando cuales traen inventario. */
  app.get('/bodegas', async () => {
    const bodegas = await prisma.bodega.findMany({
      select: {
        id: true,
        slug: true,
        nombre: true,
        tieneInventario: true,
        _count: { select: { stocks: true } },
      },
      orderBy: [{ tieneInventario: 'desc' }, { nombre: 'asc' }],
    });

    return {
      bodegas: bodegas.map((b) => ({
        id: b.id,
        slug: b.slug,
        nombre: b.nombre,
        tieneInventario: b.tieneInventario,
        articulos: b._count.stocks,
      })),
    };
  });

  /** Abre (o retoma) el conteo del periodo para una bodega. */
  app.post<{ Body: { bodegaId?: string; periodo?: string } }>(
    '/conteos',
    async (req, reply) => {
      const { bodegaId } = req.body ?? {};
      const periodo = req.body?.periodo ?? periodoActual();
      if (!bodegaId) return reply.code(400).send({ error: 'Falta la bodega.' });

      const bodega = await prisma.bodega.findUnique({ where: { id: bodegaId } });
      if (!bodega) return reply.code(404).send({ error: 'Bodega no encontrada.' });

      const existente = await prisma.conteo.findUnique({
        where: { bodegaId_periodo: { bodegaId, periodo } },
      });

      const conteo =
        existente ??
        (await prisma.conteo.create({
          data: {
            bodegaId,
            periodo,
            // El inventario queda fechado al ultimo dia del mes, como el proceso real.
            fechaCorte: ultimoDiaDelMes(periodo),
            creadoPorId: req.sesion!.usuarioId,
          },
        }));

      // Quien abre o retoma un conteo queda registrado como participante:
      // es lo que permite atribuir capturas y detectar conteos simultaneos.
      await prisma.conteoParticipante.upsert({
        where: {
          conteoId_usuarioId: { conteoId: conteo.id, usuarioId: req.sesion!.usuarioId },
        },
        create: {
          conteoId: conteo.id,
          usuarioId: req.sesion!.usuarioId,
          rol: req.sesion!.rol,
        },
        update: {},
      });

      return { conteo: { id: conteo.id, bodegaId, periodo, estado: conteo.estado } };
    },
  );

  /** Estado del conteo: progreso y quien mas esta contando ahora. */
  app.get<{ Params: { id: string } }>('/conteos/:id', async (req, reply) => {
    const conteo = await prisma.conteo.findUnique({
      where: { id: req.params.id },
      include: {
        bodega: { select: { id: true, nombre: true, slug: true } },
        participante: { include: { usuario: { select: { id: true, nombre: true } } } },
      },
    });
    if (!conteo) return reply.code(404).send({ error: 'Conteo no encontrado.' });

    const [totalArticulos, contados] = await Promise.all([
      prisma.stock.count({ where: { bodegaId: conteo.bodegaId } }),
      prisma.captura.findMany({
        where: { conteoId: conteo.id, estado: 'ACTIVA' },
        select: { articuloId: true },
        distinct: ['articuloId'],
      }),
    ]);

    return {
      conteo: {
        id: conteo.id,
        periodo: conteo.periodo,
        estado: conteo.estado,
        fechaCorte: conteo.fechaCorte,
        bodega: conteo.bodega,
        progreso: { contados: contados.length, total: totalArticulos },
        participantes: conteo.participante.map((p) => ({
          id: p.usuario.id,
          nombre: p.usuario.nombre,
          rol: p.rol,
        })),
      },
    };
  });

  /**
   * Catalogo que se descarga al dispositivo para trabajar sin red.
   *
   * Devuelve `exp10` (orden de magnitud) y NO `sd`. Con eso el dispositivo
   * detecta el salto 9 -> 90 en modo avion; quien abriera las herramientas del
   * navegador solo aprenderia "esto suele estar en las decenas", que no permite
   * copiar la respuesta. La integridad del conteo ciego queda intacta.
   */
  app.get<{ Params: { id: string } }>('/conteos/:id/catalogo', async (req, reply) => {
    const conteo = await prisma.conteo.findUnique({
      where: { id: req.params.id },
      select: { id: true, bodegaId: true, bodega: { select: { nombre: true } } },
    });
    if (!conteo) return reply.code(404).send({ error: 'Conteo no encontrado.' });

    const filas = await prisma.stock.findMany({
      where: { bodegaId: conteo.bodegaId },
      // `select` explicito: `sd` NO se pide. Ver el comentario de cabecera.
      select: {
        exp10: true,
        orden: true,
        articulo: {
          select: {
            id: true,
            nrArticulo: true,
            nombre: true,
            nombreNormalizado: true,
            unidad: true,
            familia: true,
          },
        },
      },
      orderBy: { orden: 'asc' },
    });

    const codigos = await prisma.codigoArticulo.findMany({
      where: { articuloId: { in: filas.map((f) => f.articulo.id) } },
      select: { codigo: true, articuloId: true },
    });

    return {
      conteoId: conteo.id,
      bodega: conteo.bodega.nombre,
      // Permite al cliente saber si su copia local sigue vigente.
      version: `${filas.length}-${conteo.bodegaId}`,
      articulos: filas.map((f) => ({
        id: f.articulo.id,
        nrArticulo: f.articulo.nrArticulo,
        nombre: f.articulo.nombre,
        nombreNormalizado: f.articulo.nombreNormalizado,
        unidad: f.articulo.unidad,
        familia: f.articulo.familia,
        orden: f.orden,
        exp10: f.exp10,
      })),
      codigos,
    };
  });

  void aNumero;
}

function periodoActual(): string {
  const hoy = new Date();
  return `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ultimoDiaDelMes(periodo: string): Date {
  const [anio, mes] = periodo.split('-').map(Number);
  return new Date(Date.UTC(anio, mes, 0, 23, 59, 59));
}
