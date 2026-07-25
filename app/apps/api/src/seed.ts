/**
 * Carga `datos/BODEGAS Y STOCK.xlsx` a Postgres.
 *
 * Se ejecuta solo si la base esta vacia, asi que `docker compose up` deja el
 * sistema listo sin pasos manuales.
 *
 * Particularidades del archivo que este script maneja a proposito:
 *  - la hoja KIOSCO PISCIGIROS trae el header con typo (`CANTIDA`), asi que
 *    las columnas se buscan de forma tolerante en vez de por nombre exacto;
 *  - algunas hojas traen filas de relleno al final sin nombre de articulo;
 *  - `Nr.Artículo` llega como float (9.7503113E7) y falta en 252 de 1405 filas;
 *  - los nombres traen espacios no-rompibles y prefijos/sufijos de clasificacion;
 *  - solo 8 de las 48 bodegas listadas tienen hoja de stock.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { descomponerNombre, normalizar, calcularExp10, UNIDADES } from '@conteo/core';
import { clasificarFamilia } from './familias.ts';

const prisma = new PrismaClient();

const AQUI = path.dirname(fileURLToPath(import.meta.url));
/** Por defecto sube desde apps/api/src hasta la raiz del repo y entra a datos/. */
const RUTA_XLSX =
  process.env.RUTA_XLSX ?? path.resolve(AQUI, '../../../../datos/BODEGAS Y STOCK.xlsx');

const HOJA_BODEGAS = 'BODEGAS DISPONIBLES';
const UNIDADES_VALIDAS = new Set<string>(UNIDADES);

type Fila = Record<string, unknown>;

/** Busca una columna tolerando typos, acentos y espacios ('CANTIDA' vs 'CANTIDAD'). */
function columna(fila: Fila, ...alias: string[]): unknown {
  const claves = Object.keys(fila);
  for (const a of alias) {
    const objetivo = normalizar(a);
    const clave = claves.find((k) => normalizar(k) === objetivo);
    if (clave !== undefined) return fila[clave];
    // Coincidencia por prefijo: cubre 'CANTIDA' contra 'CANTIDAD'.
    const parcial = claves.find((k) => {
      const n = normalizar(k);
      return n.startsWith(objetivo) || objetivo.startsWith(n);
    });
    if (parcial !== undefined) return fila[parcial];
  }
  return undefined;
}

function textoODefecto(valor: unknown): string {
  return valor == null ? '' : String(valor);
}

/** Los Nr.Artículo llegan como float; se normalizan a entero en texto. */
function formatearNr(bruto: unknown): string | null {
  if (bruto == null || bruto === '') return null;
  const n = Number(bruto);
  if (!Number.isFinite(n)) {
    const s = String(bruto).trim();
    return s.length ? s : null;
  }
  return String(Math.round(n));
}

/** "STOCK KIOSCO PISCIGIROS AYB " -> "Kiosco Piscigiros AyB". */
function nombreDesdeHoja(hoja: string): string {
  const limpio = hoja
    .replace(/^\s*STOCK\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return limpio
    .split(' ')
    .map((p) => {
      if (p === 'ayb') return 'AyB';
      if (p === 'sumin') return 'Suministros';
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(' ');
}

function slugificar(nombre: string): string {
  return normalizar(nombre)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Tablas en orden inverso de dependencia, para poder truncar en cascada. */
const TABLAS = [
  'Captura', 'ConteoParticipante', 'Conteo', 'ArticuloFactor',
  'CodigoArticulo', 'Stock', 'Articulo', 'Bodega', 'Usuario',
];

async function main() {
  const reset = process.argv.includes('--reset') || process.env.SEED_RESET === '1';

  if (reset) {
    console.log('Vaciando tablas (--reset)...');
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${TABLAS.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
    );
  } else if ((await prisma.articulo.count()) > 0) {
    // Idempotente a proposito: `docker compose up` puede reiniciar el contenedor
    // varias veces y el catalogo no debe duplicarse. Para recargar: --reset.
    const [bodegas, articulos, stock] = await Promise.all([
      prisma.bodega.count(),
      prisma.articulo.count(),
      prisma.stock.count(),
    ]);
    console.log(
      `La base ya tiene datos (${bodegas} bodegas, ${articulos} articulos, ` +
        `${stock} filas de stock). Nada que hacer.\n` +
        'Para recargar desde cero:  pnpm --filter api seed -- --reset',
    );
    return;
  }

  console.log(`Leyendo ${RUTA_XLSX}`);
  const libro = XLSX.read(readFileSync(RUTA_XLSX), { type: 'buffer' });

  // ── Bodegas ────────────────────────────────────────────────────────────
  const filasBodegas = XLSX.utils.sheet_to_json<Fila>(libro.Sheets[HOJA_BODEGAS] ?? {});
  const bodegasPorSlug = new Map<string, { slug: string; nombre: string; norm: string }>();

  for (const fila of filasBodegas) {
    const nombre = textoODefecto(columna(fila, 'BODEGAS', 'BODEGA')).trim();
    if (!nombre) continue;
    const slug = slugificar(nombre);
    // La hoja trae 'cafeteria acuario suministros' repetida: se colapsa.
    if (!bodegasPorSlug.has(slug)) {
      bodegasPorSlug.set(slug, { slug, nombre, norm: normalizar(nombre) });
    }
  }
  console.log(`Bodegas listadas: ${bodegasPorSlug.size} (de ${filasBodegas.length} filas)`);

  // ── Hojas de stock ─────────────────────────────────────────────────────
  const hojasStock = libro.SheetNames.filter((n) => n !== HOJA_BODEGAS);

  interface FilaStock {
    hoja: string;
    nrArticulo: string | null;
    nombre: string;
    /** Llave de identidad del catalogo (conserva prefijo y calificador). */
    normalizado: string;
    /** Forma limpia sin prefijo ni calificador, solo para clasificar familia. */
    base: string;
    calificador: string | null;
    unidad: string;
    sd: number;
    orden: number;
  }

  const filasStock: FilaStock[] = [];
  let descartadas = 0;

  for (const hoja of hojasStock) {
    const filas = XLSX.utils.sheet_to_json<Fila>(libro.Sheets[hoja]);
    let orden = 0;
    for (const fila of filas) {
      const nombre = textoODefecto(columna(fila, 'Artículo', 'Articulo')).trim();
      const unidad = textoODefecto(columna(fila, 'Unidad')).trim();
      if (!nombre || !UNIDADES_VALIDAS.has(unidad)) {
        descartadas++;
        continue;
      }
      const desc = descomponerNombre(nombre);
      if (!desc.normalizado) {
        descartadas++;
        continue;
      }
      // La llave de identidad CONSERVA prefijo y calificador: 'PORCION DE
      // CADERA X 100 GRS (PA)' y la version sin '(PA)' son articulos distintos
      // con costo distinto, tal como explico Colsubsidio con el caso del arroz
      // homologado vs 'arroz doña pepa'. Colapsarlos perderia inventario real.
      // El matcher no usa esta llave: re-deriva su propia forma desde `nombre`.
      const clave = normalizar(nombre);
      const sdBruto = columna(fila, 'SD');
      const sd = sdBruto == null || sdBruto === '' ? 0 : Number(sdBruto);

      filasStock.push({
        hoja,
        nrArticulo: formatearNr(columna(fila, 'Nr.Artículo', 'Nr.Articulo', 'NrArticulo')),
        nombre,
        normalizado: clave,
        /** Forma limpia, sin prefijo ni calificador: solo para clasificar familia. */
        base: desc.normalizado,
        calificador: desc.calificador,
        unidad,
        sd: Number.isFinite(sd) ? sd : 0,
        orden: orden++,
      });
    }
    console.log(`  ${hoja}: ${orden} filas validas`);
  }
  console.log(`Filas de stock: ${filasStock.length} (descartadas ${descartadas})`);

  // ── Catalogo deduplicado por nombre normalizado ─────────────────────────
  interface ArticuloSeed {
    nrArticulo: string | null;
    nombre: string;
    nombreNormalizado: string;
    unidad: string;
    familia: string;
  }
  const articulos = new Map<string, ArticuloSeed>();

  for (const f of filasStock) {
    const previo = articulos.get(f.normalizado);
    if (previo) {
      // Una hoja puede traer el Nr que a otra le falta.
      if (!previo.nrArticulo && f.nrArticulo) previo.nrArticulo = f.nrArticulo;
      continue;
    }
    articulos.set(f.normalizado, {
      nrArticulo: f.nrArticulo,
      nombre: f.nombre,
      nombreNormalizado: f.normalizado,
      unidad: f.unidad,
      familia: clasificarFamilia(f.base, f.calificador),
    });
  }
  console.log(`Articulos distintos: ${articulos.size}`);

  // ── Bodegas que ademas tienen hoja de stock ────────────────────────────
  // El nombre de la hoja ('STOCK ALMACEN AYB ') no coincide literalmente con
  // el de la lista, asi que se emparejan por tokens compartidos.
  // El emparejamiento es UNO A UNO y obligatorio. Antes se elegia la bodega
  // mas parecida sin reservarla, y 'STOCK ALMACEN SUMINISTROS' y
  // 'STOCK ALMACEN AYB' caian ambas en 'almacen general' por compartir el
  // token ALMACEN: dos almacenes distintos fusionados y 52 filas de inventario
  // real perdidas en silencio. Una bodega ya tomada no se vuelve a asignar, y
  // si no hay pareja limpia la hoja se convierte en su propia bodega.
  const hojaABodega = new Map<string, string>();
  const slugsTomados = new Set<string>();

  for (const hoja of hojasStock) {
    const tokensHoja = new Set(
      normalizar(hoja.replace(/^STOCK/i, '')).split(' ').filter((t) => t.length > 2),
    );

    let mejor: { slug: string; puntaje: number } | null = null;
    for (const b of bodegasPorSlug.values()) {
      if (slugsTomados.has(b.slug)) continue;
      const tokensBodega = new Set(normalizar(b.nombre).split(' ').filter((t) => t.length > 2));
      let comunes = 0;
      for (const t of tokensHoja) if (tokensBodega.has(t)) comunes++;
      // Se exige parecido en AMBOS sentidos: asi 'ALMACEN AYB' no se cuela en
      // 'almacen general' solo porque 'ALMACEN' aparece en los dos.
      const puntaje =
        comunes / Math.max(1, Math.max(tokensHoja.size, tokensBodega.size));
      if (!mejor || puntaje > mejor.puntaje) mejor = { slug: b.slug, puntaje };
    }

    if (mejor && mejor.puntaje >= 0.75) {
      hojaABodega.set(hoja, mejor.slug);
      slugsTomados.add(mejor.slug);
    } else {
      // El nombre de la hoja se usa como nombre de bodega, pero limpio: el
      // prefijo "STOCK" es del archivo, no del almacen, y el lider de costos
      // no llama "STOCK KIOSCO PISCIGIROS AYB" a su bodega.
      const nombre = nombreDesdeHoja(hoja);
      const slug = slugificar(nombre);
      bodegasPorSlug.set(slug, { slug, nombre, norm: normalizar(nombre) });
      hojaABodega.set(hoja, slug);
      slugsTomados.add(slug);
    }
  }

  console.log('\nHoja de stock -> bodega:');
  for (const [hoja, slug] of hojaABodega) console.log(`  ${hoja.trim()} -> ${slug}`);

  // ── Escritura ──────────────────────────────────────────────────────────
  console.log('\nEscribiendo en la base...');

  await prisma.bodega.createMany({
    data: [...bodegasPorSlug.values()].map((b) => ({
      slug: b.slug,
      nombre: b.nombre,
      nombreNormalizado: b.norm,
      tieneInventario: [...hojaABodega.values()].includes(b.slug),
      hojaOrigen: [...hojaABodega.entries()].find(([, s]) => s === b.slug)?.[0] ?? null,
    })),
    skipDuplicates: true,
  });

  await prisma.articulo.createMany({
    data: [...articulos.values()],
    skipDuplicates: true,
  });

  const bodegasDb = await prisma.bodega.findMany({ select: { id: true, slug: true } });
  const articulosDb = await prisma.articulo.findMany({
    select: { id: true, nombreNormalizado: true },
  });
  const idBodega = new Map(bodegasDb.map((b) => [b.slug, b.id]));
  const idArticulo = new Map(articulosDb.map((a) => [a.nombreNormalizado, a.id]));

  const stocks: {
    bodegaId: string;
    articuloId: string;
    sd: number;
    exp10: number | null;
    orden: number;
  }[] = [];
  const vistos = new Set<string>();

  for (const f of filasStock) {
    const bodegaId = idBodega.get(hojaABodega.get(f.hoja)!);
    const articuloId = idArticulo.get(f.normalizado);
    if (!bodegaId || !articuloId) continue;
    const llave = `${bodegaId}|${articuloId}`;
    if (vistos.has(llave)) continue; // el mismo articulo repetido en una hoja
    vistos.add(llave);
    stocks.push({
      bodegaId,
      articuloId,
      sd: f.sd,
      exp10: calcularExp10(f.sd),
      orden: f.orden,
    });
  }

  await prisma.stock.createMany({ data: stocks, skipDuplicates: true });

  // ── Usuarios de demostracion ───────────────────────────────────────────
  await prisma.usuario.createMany({
    data: [
      { nombre: 'Ana Gómez', pin: '1111', rol: 'CONTADOR' },
      { nombre: 'Luis Ramírez', pin: '2222', rol: 'CONTADOR' },
      { nombre: 'Sandra Peña', pin: '3333', rol: 'CONTADOR' },
      { nombre: 'Bibiana Torres', pin: '9999', rol: 'LIDER' },
    ],
    skipDuplicates: true,
  });

  const negativos = filasStock.filter((f) => f.sd < 0).length;
  const decimalesEnUnidad = filasStock.filter(
    (f) => f.unidad === 'Unidad' && !Number.isInteger(f.sd),
  ).length;
  const sinNr = filasStock.filter((f) => !f.nrArticulo).length;

  console.log(`
Listo.
  bodegas          ${bodegasPorSlug.size}  (${hojaABodega.size} con inventario)
  articulos        ${articulos.size}
  filas de stock   ${stocks.length}
  usuarios demo    4

Suciedad heredada del sistema origen (insumo de las reglas de anomalia):
  saldos negativos       ${negativos}
  decimales en 'Unidad'  ${decimalesEnUnidad}
  sin Nr.Articulo        ${sinNr}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
