/**
 * Deja una bodega parcialmente contada, para grabar el video de pitch sin
 * empezar en cero y con un reporte de diferencias que ya tiene contenido.
 *
 *   pnpm --filter api demo                    # siembra
 *   pnpm --filter api demo -- --limpiar       # borra lo sembrado y nada mas
 *
 * Es idempotente: vuelve a correrlo y reemplaza el conteo de demostracion sin
 * tocar el catalogo ni los conteos reales.
 *
 * Que deja montado, y por que:
 *  - ~38 de 56 articulos contados: la barra de progreso se ve a medias, y
 *    quedan articulos sin contar para hacer la captura EN VIVO durante la toma.
 *  - Los cuatro metodos de captura mezclados (voz, teclado, camara, busqueda),
 *    para que la hoja TRAZABILIDAD del export no sea monotona.
 *  - Diferencias realistas: la mayoria cuadra o casi, unas pocas se desvian.
 *    Un inventario donde todo cuadra no tendria nada que reportar.
 *  - Una captura con anomalia CONFIRMADA y su motivo declarado: es la columna
 *    que EXPLICA el descuadre en vez de solo listarlo.
 *  - Un articulo contado por dos personas -> queda EN CONFLICTO, sin sumarse.
 *
 * A proposito NO se cuentan de antemano los articulos del guion (ACEITE y los
 * dos primeros): tienen que estar libres para contarlos frente a la camara.
 */

import { PrismaClient } from '@prisma/client';
import { calcularExp10, ordenDeMagnitud } from '@conteo/core';

const prisma = new PrismaClient();

const BODEGA = process.env.DEMO_BODEGA ?? 'kiosco-piscigiros-ayb';
const PERIODO = process.env.DEMO_PERIODO ?? periodoActual();

/** Articulos que se dejan SIN contar para la demostracion en vivo. */
const RESERVADOS_PARA_LA_CAMARA = ['ACEITE', 'AGUA 280 ML', 'AGUA BOTELLA'];

/** Cuantos de los restantes se dejan contados. */
const A_CONTAR = 38;

interface Guion {
  metodo: 'VOZ' | 'TECLADO' | 'CAMARA' | 'BUSQUEDA';
  /** Multiplica el stock del sistema para obtener lo "contado". */
  factor: number;
  textoCrudo?: (nombre: string, cantidad: number) => string;
  anomalias?: string[];
  motivo?: string;
}

/**
 * Reparto de metodos y desviaciones. La mayoria cuadra exacto porque asi es un
 * inventario sano; las desviaciones son las que hacen util el reporte.
 */
const GUIONES: Guion[] = [
  { metodo: 'VOZ', factor: 1, textoCrudo: (n, c) => `${c} de ${n.toLowerCase()}` },
  { metodo: 'TECLADO', factor: 1 },
  { metodo: 'VOZ', factor: 0.92, textoCrudo: (n, c) => `${c} de ${n.toLowerCase()}` },
  { metodo: 'BUSQUEDA', factor: 1 },
  { metodo: 'TECLADO', factor: 1.05 },
  { metodo: 'CAMARA', factor: 1 },
  { metodo: 'VOZ', factor: 1, textoCrudo: (n, c) => `${c} de ${n.toLowerCase()}` },
  { metodo: 'TECLADO', factor: 0.8 },
];

function periodoActual(): string {
  const hoy = new Date();
  return `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ultimoDiaDelMes(periodo: string): Date {
  const [anio, mes] = periodo.split('-').map(Number);
  return new Date(Date.UTC(anio, mes, 0, 23, 59, 59));
}

/** Redondea a entero si el articulo no admite fracciones. */
function ajustar(valor: number, unidad: string): number {
  if (valor < 0) return 0;
  if (unidad === 'Unidad') return Math.max(0, Math.round(valor));
  return Math.max(0, Math.round(valor * 100) / 100);
}

async function main() {
  const limpiar = process.argv.includes('--limpiar');

  const bodega = await prisma.bodega.findUnique({ where: { slug: BODEGA } });
  if (!bodega) throw new Error(`No existe la bodega ${BODEGA}. ¿Corriste el seed?`);

  const existente = await prisma.conteo.findUnique({
    where: { bodegaId_periodo: { bodegaId: bodega.id, periodo: PERIODO } },
  });
  if (existente) {
    await prisma.conteo.delete({ where: { id: existente.id } });
    console.log('Conteo de demostración anterior eliminado.');
  }
  if (limpiar) {
    console.log('Listo (solo limpieza).');
    return;
  }

  const usuarios = await prisma.usuario.findMany();
  const ana = usuarios.find((u) => u.nombre.startsWith('Ana'));
  const luis = usuarios.find((u) => u.nombre.startsWith('Luis'));
  const lider = usuarios.find((u) => u.rol === 'LIDER');
  if (!ana || !luis || !lider) throw new Error('Faltan los usuarios de demostración.');

  const conteo = await prisma.conteo.create({
    data: {
      bodegaId: bodega.id,
      periodo: PERIODO,
      fechaCorte: ultimoDiaDelMes(PERIODO),
      creadoPorId: ana.id,
      participante: {
        create: [
          { usuarioId: ana.id, rol: 'CONTADOR' },
          { usuarioId: luis.id, rol: 'CONTADOR' },
          { usuarioId: lider.id, rol: 'LIDER' },
        ],
      },
    },
  });

  const stocks = await prisma.stock.findMany({
    where: { bodegaId: bodega.id },
    include: { articulo: true },
    orderBy: { orden: 'asc' },
  });

  const reservados = new Set(RESERVADOS_PARA_LA_CAMARA);
  const candidatos = stocks.filter(
    (s) =>
      !reservados.has(s.articulo.nombre.trim()) &&
      // Los saldos negativos no se cuentan de antemano: son basura heredada del
      // sistema y quedan mejor como "sin contar" en el reporte.
      Number(s.sd.toString()) > 0,
  );

  const aContar = candidatos.slice(0, A_CONTAR);
  const base = Date.now() - 52 * 60 * 1000; // el conteo "empezó" hace ~52 min
  const filas: Parameters<typeof prisma.captura.createMany>[0]['data'] = [];

  aContar.forEach((s, i) => {
    const guion = GUIONES[i % GUIONES.length];
    const sd = Number(s.sd.toString());
    const cantidad = ajustar(sd * guion.factor, s.articulo.unidad);
    const nombre = s.articulo.nombre.trim();

    filas.push({
      clientId: `demo-${conteo.id}-${i}`,
      conteoId: conteo.id,
      articuloId: s.articuloId,
      cantidad,
      unidad: s.articulo.unidad,
      metodo: guion.metodo,
      textoCrudo: guion.textoCrudo?.(nombre, cantidad) ?? null,
      scoreMatch: guion.metodo === 'VOZ' ? 0.9 + (i % 7) / 100 : null,
      anomalias: [],
      usuarioId: i % 5 === 0 ? luis.id : ana.id,
      deviceId: i % 5 === 0 ? 'tablet-02' : 'tablet-01',
      capturadoEn: new Date(base + i * 78_000),
      estado: 'ACTIVA',
    });
  });

  // ── Una anomalía confirmada, con su motivo declarado ───────────────────
  // Es lo que hace valiosa la hoja TRAZABILIDAD: no solo dice que hubo un
  // descuadre, dice por qué la persona decidió que era correcto.
  const paraAnomalia = candidatos[A_CONTAR];
  if (paraAnomalia) {
    const sd = Number(paraAnomalia.sd.toString());
    const exagerada = ajustar(sd * 10, paraAnomalia.articulo.unidad);
    const exp10 = calcularExp10(sd);
    const orden = ordenDeMagnitud(exagerada);
    filas.push({
      clientId: `demo-${conteo.id}-anomalia`,
      conteoId: conteo.id,
      articuloId: paraAnomalia.articuloId,
      cantidad: exagerada,
      unidad: paraAnomalia.articulo.unidad,
      metodo: 'TECLADO',
      textoCrudo: String(exagerada),
      anomalias:
        exp10 !== null && orden !== null && Math.abs(orden - exp10) >= 1
          ? ['R8_SALTO_DE_MAGNITUD']
          : [],
      motivoConfirmacion: 'Llegó pedido nuevo',
      usuarioId: ana.id,
      deviceId: 'tablet-01',
      capturadoEn: new Date(base + (A_CONTAR + 1) * 78_000),
      estado: 'ACTIVA',
    });
  }

  // ── Un artículo contado por dos personas ───────────────────────────────
  // No se suma en silencio: queda EN CONFLICTO y el líder decide si fue
  // recuento o una ubicación distinta del mismo producto.
  const enConflicto = aContar[3];
  if (enConflicto) {
    const sd = Number(enConflicto.sd.toString());
    filas.push({
      clientId: `demo-${conteo.id}-conflicto`,
      conteoId: conteo.id,
      articuloId: enConflicto.articuloId,
      cantidad: ajustar(sd * 0.6, enConflicto.articulo.unidad),
      unidad: enConflicto.articulo.unidad,
      metodo: 'TECLADO',
      usuarioId: luis.id,
      deviceId: 'tablet-02',
      anomalias: ['R7_DUPLICADO_EN_SESION'],
      enConflicto: true,
      capturadoEn: new Date(base + (A_CONTAR + 2) * 78_000),
      estado: 'ACTIVA',
    });
    // La de Ana también se marca: el conflicto es entre las dos.
    const mia = filas.find((f) => f.articuloId === enConflicto.articuloId);
    if (mia) mia.enConflicto = true;
  }

  await prisma.captura.createMany({ data: filas });

  const contados = new Set(filas.map((f) => f.articuloId)).size;
  console.log(`
Bodega de demostración lista.

  bodega            ${bodega.nombre}
  periodo           ${PERIODO}
  progreso          ${contados}/${stocks.length} artículos
  capturas          ${filas.length}
  contadores        ${ana.nombre} (tablet-01) y ${luis.nombre} (tablet-02)
  en conflicto      1 artículo contado por ambos
  anomalía guardada 1, con motivo declarado

Libres para contar frente a la cámara:
${RESERVADOS_PARA_LA_CAMARA.map((n) => `  · ${n}`).join('\n')}

  ACEITE tiene stock 30,59 L → teclear 900 dispara la verificación
  y ofrece "¿Eran 90?" sin revelar el 30,59.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
