/**
 * Exportacion. El punto final del reto: "informacion limpia lista para el ERP".
 *
 * Tres hojas:
 *  1. CONTEO        — reemplaza el paso de digitacion. Espeja EXACTAMENTE las
 *                     columnas del archivo de insumo, con el nombre verbatim,
 *                     para que el lider de costos reconozca sus propias filas.
 *  2. DIFERENCIAS   — contado vs sistema. La duena del negocio lo puso en su
 *                     lista central ("cuanto subi y cuanto me cargo al
 *                     sistema"), no en los bonus.
 *  3. TRAZABILIDAD  — quien, cuando, con que metodo, que dijo literal y que
 *                     anomalias se dispararon. Insumo directo para la app de
 *                     auditoria, que es un sistema aparte.
 *
 * Se emite tambien CSV con BOM y separador ';' porque es lo que Excel en
 * configuracion regional colombiana abre sin romper acentos ni columnas.
 *
 * ADVERTENCIA HONESTA: el spec exacto de columnas que carga Oracle nunca se
 * confirmo. Se pregunto en vivo y la respuesta quedo entrecortada. Espejar el
 * formato de entrada es la apuesta mas segura, y queda declarado en el README.
 */

import type { FastifyInstance } from 'fastify';
import ExcelJS from 'exceljs';
import { prisma, aNumero } from '../db.ts';
import { requiereLider } from '../auth.ts';

interface FilaReporte {
  articuloId: string;
  nrArticulo: string | null;
  nombre: string;
  unidad: string;
  familia: string;
  orden: number;
  sistema: number;
  contado: number | null;
  contadores: string[];
  /** Cuánto reportó cada persona. Es lo que el líder necesita para decidir. */
  porContador: { nombre: string; cantidad: number }[];
  metodos: string[];
  anomalias: string[];
  motivos: string[];
  enConflicto: boolean;
  /** Total dado de baja para este artículo. */
  merma: number;
  /**
   * Lo que queda del descuadre después de descontar la merma documentada.
   * Es el número que de verdad hay que investigar.
   */
  sinExplicar: number | null;
}

async function armarReporte(conteoId: string) {
  const conteo = await prisma.conteo.findUnique({
    where: { id: conteoId },
    include: { bodega: true },
  });
  if (!conteo) return null;

  const stocks = await prisma.stock.findMany({
    where: { bodegaId: conteo.bodegaId },
    select: {
      sd: true,
      orden: true,
      articulo: {
        select: { id: true, nrArticulo: true, nombre: true, unidad: true, familia: true },
      },
    },
    orderBy: { orden: 'asc' },
  });

  const todas = await prisma.captura.findMany({
    where: { conteoId, estado: 'ACTIVA' },
    select: {
      articuloId: true,
      cantidad: true,
      unidad: true,
      unidadDicha: true,
      metodo: true,
      textoCrudo: true,
      anomalias: true,
      motivoConfirmacion: true,
      enConflicto: true,
      capturadoEn: true,
      scoreMatch: true,
      tipo: true,
      motivoMerma: true,
      incluidoEnConteo: true,
      fotoUrl: true,
      usuario: { select: { nombre: true } },
    },
    orderBy: { capturadoEn: 'asc' },
  });

  // Las bajas no son conteo: van por su cuenta en todos los cálculos.
  const capturas = todas.filter((c) => c.tipo !== 'MERMA');
  const mermas = todas.filter((c) => c.tipo === 'MERMA');

  const porArticulo = new Map<string, typeof capturas>();
  for (const c of capturas) {
    const lista = porArticulo.get(c.articuloId) ?? [];
    lista.push(c);
    porArticulo.set(c.articuloId, lista);
  }

  const mermaPorArticulo = new Map<string, number>();
  for (const m of mermas) {
    mermaPorArticulo.set(
      m.articuloId,
      (mermaPorArticulo.get(m.articuloId) ?? 0) + aNumero(m.cantidad),
    );
  }
  /**
   * Merma que YA está dentro de lo contado (el producto dañado seguía en el
   * estante). Esa parte no explica el faltante: si se restara otra vez, se
   * contaría dos veces.
   */
  const mermaIncluida = new Map<string, number>();
  for (const m of mermas.filter((x) => x.incluidoEnConteo)) {
    mermaIncluida.set(
      m.articuloId,
      (mermaIncluida.get(m.articuloId) ?? 0) + aNumero(m.cantidad),
    );
  }

  const filas: FilaReporte[] = stocks.map((s) => {
    const propias = porArticulo.get(s.articulo.id) ?? [];
    const enConflicto = propias.some((c) => c.enConflicto);

    // Cuánto reportó cada persona por separado.
    const acumulado = new Map<string, number>();
    for (const c of propias) {
      acumulado.set(
        c.usuario.nombre,
        (acumulado.get(c.usuario.nombre) ?? 0) + aNumero(c.cantidad),
      );
    }
    const porContador = [...acumulado].map(([nombre, cantidad]) => ({ nombre, cantidad }));

    return {
      articuloId: s.articulo.id,
      nrArticulo: s.articulo.nrArticulo,
      nombre: s.articulo.nombre,
      unidad: s.articulo.unidad,
      familia: s.articulo.familia,
      orden: s.orden,
      sistema: aNumero(s.sd),
      // Tres estados distintos, y confundirlos descuadraria el inventario:
      //
      //  · sin capturas      -> null. "Vacio" es una ausencia (nadie lo conto),
      //                         y NO es lo mismo que cero, que es una
      //                         afirmacion (esta agotado).
      //  · en conflicto      -> null. Dos personas reportaron cantidades
      //                         distintas para el mismo articulo y NADIE ha
      //                         decidido si fue un recuento (reemplaza) o dos
      //                         ubicaciones (suma). Sumarlas seria inventar el
      //                         dato: exactamente el error que este producto
      //                         existe para eliminar. Queda sin valor hasta que
      //                         el lider resuelva, y las cifras de cada persona
      //                         viajan en `porContador` para que pueda hacerlo.
      //  · normal            -> suma de sus capturas, que es lo correcto cuando
      //                         una misma persona cuenta en varias ubicaciones.
      contado: !propias.length || enConflicto
        ? null
        : propias.reduce((acc, c) => acc + aNumero(c.cantidad), 0),
      contadores: [...acumulado.keys()],
      porContador,
      metodos: [...new Set(propias.map((c) => c.metodo))],
      anomalias: [...new Set(propias.flatMap((c) => (c.anomalias as string[]) ?? []))],
      motivos: propias.map((c) => c.motivoConfirmacion).filter(Boolean) as string[],
      enConflicto,
      merma: mermaPorArticulo.get(s.articulo.id) ?? 0,
      sinExplicar: null, // se calcula abajo, cuando ya hay `contado`
    };
  });

  // El descuadre que la merma NO explica.
  //
  //   diferencia = contado − sistema            (negativo = falta producto)
  //   la merma retirada del estante explica parte de ese faltante
  //   la merma que seguía en el estante ya entró en `contado`: no se resta
  //
  // Con esto, un faltante de 12,59 L del que 12 son un derrame documentado
  // se convierte en 0,59 L por investigar. Eso es lo que pidió la dueña del
  // proceso: no una lista de descuadres, sino saber cuáles siguen sin
  // explicación.
  for (const f of filas) {
    if (f.contado === null) continue;
    const diferencia = f.contado - f.sistema;
    const mermaQueExplica = f.merma - (mermaIncluida.get(f.articuloId) ?? 0);
    f.sinExplicar = Number((diferencia + mermaQueExplica).toFixed(3));
  }

  return { conteo, filas, capturas, mermas };
}

export async function rutasExportacion(app: FastifyInstance) {
  /**
   * TODO lo de este archivo es solo del lider de costos.
   *
   * No es una formalidad: estas rutas devuelven `sd`, la cantidad que el
   * sistema espera. Estaban protegidas unicamente con `requiereSesion`, asi
   * que cualquier contador podia pedir /reporte desde el navegador y ver los
   * valores esperados A MITAD del conteo — justo lo que el conteo ciego
   * existe para impedir. La UI nunca lo hacia, pero "la UI no lo hace" no es
   * un control de acceso.
   */
  app.addHook('preHandler', requiereLider);

  /** Resumen en pantalla para el lider, antes de descargar. */
  app.get<{ Params: { id: string } }>('/conteos/:id/reporte', async (req, reply) => {
    const datos = await armarReporte(req.params.id);
    if (!datos) return reply.code(404).send({ error: 'Conteo no encontrado.' });

    const { filas } = datos;
    // Tres estados que NO se solapan, y que suman el total del catálogo:
    //   resuelto     -> tiene cantidad definitiva
    //   en conflicto -> se contó, pero falta que el líder decida
    //   sin contar   -> nadie lo tocó
    // Meter los conflictos en "sin contar" seria mentir: si se contaron.
    const contadas = filas.filter((f) => f.contado !== null);
    const enConflicto = filas.filter((f) => f.enConflicto);
    const sinContar = filas.filter((f) => f.contado === null && !f.enConflicto);
    const conDiferencia = contadas.filter((f) => f.contado !== f.sistema);

    return {
      bodega: datos.conteo.bodega.nombre,
      periodo: datos.conteo.periodo,
      secuencia: datos.conteo.secuencia,
      estado: datos.conteo.estado,
      cerradoEn: datos.conteo.cerradoEn,
      notaCierre: datos.conteo.notaCierre,
      fechaCorte: datos.conteo.fechaCorte,
      // Todas las filas del catalogo, que es lo que va a la hoja CONTEO.
      // Permite ver en pantalla exactamente lo que se va a exportar.
      conteo: filas.map((f) => ({
        nrArticulo: f.nrArticulo,
        articulo: f.nombre.trim(),
        familia: f.familia,
        unidad: f.unidad,
        contado: f.contado,
        sistema: f.sistema,
        merma: f.merma,
        enConflicto: f.enConflicto,
        metodos: f.metodos,
      })),
      trazabilidad: datos.capturas.map((c) => ({
        capturadoEn: c.capturadoEn,
        usuario: c.usuario.nombre,
        articulo: filas.find((f) => f.articuloId === c.articuloId)?.nombre.trim() ?? '',
        cantidad: aNumero(c.cantidad),
        unidad: c.unidad,
        unidadDicha: c.unidadDicha,
        metodo: c.metodo,
        textoCrudo: c.textoCrudo,
        scoreMatch: c.scoreMatch,
        anomalias: c.anomalias,
        motivoConfirmacion: c.motivoConfirmacion,
        enConflicto: c.enConflicto,
      })),
      resumen: {
        articulosCatalogo: filas.length,
        contados: contadas.length,
        sinContar: sinContar.length,
        conDiferencia: conDiferencia.length,
        exactitud: contadas.length
          ? Number((((contadas.length - conDiferencia.length) / contadas.length) * 100).toFixed(1))
          : 0,
        enConflicto: enConflicto.length,
        // Cuántos descuadres deja de haber que investigar gracias a la merma.
        articulosConMerma: filas.filter((f) => f.merma > 0).length,
        descuadresExplicados: conDiferencia.filter((f) => f.sinExplicar === 0).length,
      },
      mermas: datos.mermas.map((m) => ({
        articulo:
          filas.find((f) => f.articuloId === m.articuloId)?.nombre.trim() ?? '',
        cantidad: aNumero(m.cantidad),
        unidad: m.unidad,
        motivo: m.motivoMerma,
        incluidoEnConteo: m.incluidoEnConteo,
        fotoUrl: m.fotoUrl,
        usuario: m.usuario.nombre,
        capturadoEn: m.capturadoEn,
      })),
      // Los conflictos van aparte y primero: son lo unico que el lider TIENE
      // que resolver antes de exportar, porque sin decision no hay cantidad.
      conflictos: filas
        .filter((f) => f.enConflicto)
        .map((f) => ({
          nrArticulo: f.nrArticulo,
          articulo: f.nombre.trim(),
          unidad: f.unidad,
          sistema: f.sistema,
          porContador: f.porContador,
        })),
      diferencias: conDiferencia
        .map((f) => ({
          nrArticulo: f.nrArticulo,
          articulo: f.nombre.trim(),
          unidad: f.unidad,
          sistema: f.sistema,
          contado: f.contado,
          diferencia: Number(((f.contado ?? 0) - f.sistema).toFixed(3)),
          merma: f.merma,
          sinExplicar: f.sinExplicar,
          contadores: f.contadores,
          porContador: f.porContador,
          anomalias: f.anomalias,
          enConflicto: f.enConflicto,
        }))
        .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia)),
    };
  });

  /** Hoja CONTEO en CSV: la ruta a prueba de todo si el xlsx fallara. */
  app.get<{ Params: { id: string } }>('/conteos/:id/export.csv', async (req, reply) => {
    const datos = await armarReporte(req.params.id);
    if (!datos) return reply.code(404).send({ error: 'Conteo no encontrado.' });

    const lineas = ['CANTIDAD;Nr.Artículo;Artículo;Unidad;SD'];
    datos.filas.forEach((f, i) => {
      lineas.push(
        [
          i + 1,
          f.nrArticulo ?? '',
          csv(f.nombre),
          f.unidad,
          f.contado ?? '',
        ].join(';'),
      );
    });

    // BOM: sin esto Excel en Windows abre los acentos rotos.
    const cuerpo = '﻿' + lineas.join('\r\n');
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header(
        'Content-Disposition',
        `attachment; filename="conteo-${slug(datos.conteo.bodega.nombre)}-${datos.conteo.periodo}.csv"`,
      )
      .send(cuerpo);
  });

  /** Las tres hojas. */
  app.get<{ Params: { id: string } }>('/conteos/:id/export.xlsx', async (req, reply) => {
    const datos = await armarReporte(req.params.id);
    if (!datos) return reply.code(404).send({ error: 'Conteo no encontrado.' });
    const { conteo, filas, capturas, mermas } = datos;

    const libro = new ExcelJS.Workbook();
    libro.creator = 'Conteo de inventarios — Reto 4';
    libro.created = new Date();

    // ── Hoja 1: CONTEO (mismas columnas del insumo) ────────────────────
    const h1 = libro.addWorksheet('CONTEO');
    h1.columns = [
      { header: 'CANTIDAD', key: 'n', width: 10 },
      { header: 'Nr.Artículo', key: 'nr', width: 14 },
      { header: 'Artículo', key: 'art', width: 46 },
      { header: 'Unidad', key: 'un', width: 12 },
      { header: 'SD', key: 'sd', width: 12 },
    ];
    filas.forEach((f, i) => {
      h1.addRow({
        n: i + 1,
        nr: f.nrArticulo ?? '',
        art: f.nombre,
        un: f.unidad,
        sd: f.contado ?? '',
      });
    });
    encabezar(h1);

    // ── Hoja 2: DIFERENCIAS ────────────────────────────────────────────
    const h2 = libro.addWorksheet('DIFERENCIAS');
    h2.columns = [
      { header: 'Nr.Artículo', key: 'nr', width: 14 },
      { header: 'Artículo', key: 'art', width: 46 },
      { header: 'Familia', key: 'fam', width: 18 },
      { header: 'Unidad', key: 'un', width: 12 },
      { header: 'Sistema', key: 'sis', width: 12 },
      { header: 'Contado', key: 'con', width: 12 },
      { header: 'Diferencia', key: 'dif', width: 13 },
      { header: 'Dif %', key: 'pct', width: 10 },
      { header: 'Merma', key: 'merma', width: 12 },
      { header: 'Sin explicar', key: 'sinexp', width: 14 },
      { header: 'Estado', key: 'est', width: 16 },
      { header: 'Contadores', key: 'quien', width: 26 },
      { header: 'Reportado por cada uno', key: 'detalle', width: 34 },
      { header: 'Anomalías', key: 'anom', width: 26 },
      { header: 'Motivo declarado', key: 'mot', width: 30 },
    ];
    for (const f of filas) {
      const dif = f.contado === null ? null : Number((f.contado - f.sistema).toFixed(3));
      h2.addRow({
        nr: f.nrArticulo ?? '',
        art: f.nombre.trim(),
        fam: f.familia,
        un: f.unidad,
        sis: f.sistema,
        con: f.contado ?? '',
        dif: dif ?? '',
        pct:
          dif === null || f.sistema === 0 ? '' : Number(((dif / f.sistema) * 100).toFixed(1)),
        merma: f.merma || '',
        // Lo que queda por investigar una vez descontada la merma documentada.
        sinexp: f.sinExplicar === null ? '' : f.sinExplicar,
        est: estado(f, dif),
        quien: f.contadores.join(', '),
        // Solo tiene sentido detallar cuando hay mas de una persona: es lo que
        // el lider necesita para decidir si fue recuento o doble ubicacion.
        detalle:
          f.porContador.length > 1
            ? f.porContador.map((p) => `${p.nombre}: ${p.cantidad}`).join(' | ')
            : '',
        anom: f.anomalias.join(', '),
        mot: f.motivos.join(' | '),
      });
    }
    encabezar(h2);

    // ── Hoja 3: MERMA ──────────────────────────────────────────────────
    // Va antes de la trazabilidad porque es lo que el líder mira: qué se dio
    // de baja, por qué, quién lo vio y si hay foto que lo respalde.
    const hMerma = libro.addWorksheet('MERMA');
    hMerma.columns = [
      { header: 'Fecha/hora', key: 'ts', width: 22 },
      { header: 'Nr.Artículo', key: 'nr', width: 14 },
      { header: 'Artículo', key: 'art', width: 46 },
      { header: 'Unidad', key: 'un', width: 12 },
      { header: 'Cantidad dada de baja', key: 'cant', width: 22 },
      { header: 'Motivo', key: 'mot', width: 20 },
      { header: '¿Ya estaba en el conteo?', key: 'incl', width: 24 },
      { header: 'Registró', key: 'quien', width: 22 },
      { header: 'Evidencia', key: 'foto', width: 60 },
    ];
    const nrPorArticulo = new Map(filas.map((f) => [f.articuloId, f.nrArticulo]));
    const nombrePorArticulo = new Map(filas.map((f) => [f.articuloId, f.nombre.trim()]));
    for (const m of mermas) {
      hMerma.addRow({
        ts: m.capturadoEn.toISOString().replace('T', ' ').slice(0, 19),
        nr: nrPorArticulo.get(m.articuloId) ?? '',
        art: nombrePorArticulo.get(m.articuloId) ?? '',
        un: m.unidad,
        cant: aNumero(m.cantidad),
        mot: m.motivoMerma ?? '',
        incl: m.incluidoEnConteo === null ? '' : m.incluidoEnConteo ? 'Sí' : 'No',
        quien: m.usuario.nombre,
        foto: m.fotoUrl ?? '',
      });
    }
    if (mermas.length === 0) {
      hMerma.addRow({ art: 'Sin mermas registradas en este conteo.' });
    }
    encabezar(hMerma);

    // ── Hoja 4: TRAZABILIDAD ───────────────────────────────────────────
    const h3 = libro.addWorksheet('TRAZABILIDAD');
    h3.columns = [
      { header: 'Fecha/hora', key: 'ts', width: 22 },
      { header: 'Contador', key: 'quien', width: 22 },
      { header: 'Artículo', key: 'art', width: 46 },
      { header: 'Cantidad', key: 'cant', width: 12 },
      { header: 'Unidad guardada', key: 'un', width: 16 },
      { header: 'Unidad dictada', key: 'und', width: 16 },
      { header: 'Método', key: 'met', width: 12 },
      { header: 'Texto capturado', key: 'txt', width: 40 },
      { header: 'Confianza match', key: 'score', width: 15 },
      { header: 'Anomalías', key: 'anom', width: 26 },
      { header: 'Motivo declarado', key: 'mot', width: 30 },
      { header: 'En conflicto', key: 'conf', width: 13 },
    ];
    const nombres = new Map(filas.map((f) => [f.nombre, f.nombre.trim()]));
    const porId = new Map(
      (
        await prisma.articulo.findMany({
          where: { id: { in: [...new Set(capturas.map((c) => c.articuloId))] } },
          select: { id: true, nombre: true },
        })
      ).map((a) => [a.id, a.nombre.trim()]),
    );
    for (const c of capturas) {
      h3.addRow({
        ts: c.capturadoEn.toISOString().replace('T', ' ').slice(0, 19),
        quien: c.usuario.nombre,
        art: porId.get(c.articuloId) ?? '',
        cant: aNumero(c.cantidad),
        un: c.unidad,
        und: c.unidadDicha ?? '',
        met: c.metodo,
        txt: c.textoCrudo ?? '',
        score: c.scoreMatch ?? '',
        anom: ((c.anomalias as string[]) ?? []).join(', '),
        mot: c.motivoConfirmacion ?? '',
        conf: c.enConflicto ? 'SÍ' : '',
      });
    }
    encabezar(h3);
    void nombres;

    const buffer = await libro.xlsx.writeBuffer();
    return reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header(
        'Content-Disposition',
        `attachment; filename="conteo-${slug(conteo.bodega.nombre)}-${conteo.periodo}.xlsx"`,
      )
      .send(Buffer.from(buffer));
  });
}

function estado(f: FilaReporte, dif: number | null): string {
  if (f.contado === null) return 'SIN CONTAR';
  if (f.enConflicto) return 'EN CONFLICTO';
  if (dif === 0) return 'CUADRA';
  return (dif ?? 0) > 0 ? 'SOBRANTE' : 'FALTANTE';
}

function encabezar(hoja: ExcelJS.Worksheet) {
  const fila = hoja.getRow(1);
  fila.font = { bold: true };
  fila.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEAEAEA' },
  };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
}

function csv(valor: string): string {
  const v = valor.replace(/;/g, ',').replace(/[\r\n]+/g, ' ').trim();
  return v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
}

function slug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
