/**
 * Carga el catálogo REAL desde el fixture extraído de BODEGAS Y STOCK.xlsx.
 * Se usa solo en tests y evaluación: en producción los datos vienen de la API.
 */

import fixture from './catalogo.fixture.json' with { type: 'json' };
import type { ArticuloCatalogo, Unidad } from '../tipos.ts';
import { descomponerNombre } from '../normalizar.ts';

interface Hoja {
  headers: string[];
  rows: Record<string, string>[];
}

const HOJAS = fixture as unknown as Record<string, Hoja>;

/** Las hojas de stock son todas menos el listado de bodegas. */
export const HOJAS_STOCK = Object.keys(HOJAS).filter((n) => n !== 'BODEGAS DISPONIBLES');

const UNIDADES_VALIDAS = new Set<string>(['Unidad', 'Kilogram', 'Liter', 'Portion']);

export interface FilaStock {
  hoja: string;
  nrArticulo: string | null;
  nombre: string;
  unidad: Unidad;
  sd: number;
  /** Índice de fila original = orden físico del formato impreso. */
  orden: number;
}

/**
 * Lee las filas de stock. Tolera el header con typo (`CANTIDA`) y descarta
 * filas sin nombre de artículo (el xlsx trae algunas de relleno al final).
 */
export function leerFilasStock(): FilaStock[] {
  const filas: FilaStock[] = [];

  for (const hoja of HOJAS_STOCK) {
    const { rows } = HOJAS[hoja];
    rows.forEach((row, i) => {
      const nombre = (row['Artículo'] ?? '').toString();
      if (!nombre.trim()) return;

      const unidadBruta = (row['Unidad'] ?? '').toString().trim();
      if (!UNIDADES_VALIDAS.has(unidadBruta)) return;

      const sdBruto = row['SD'];
      const sd = sdBruto == null || sdBruto === '' ? 0 : Number(sdBruto);

      const nr = row['Nr.Artículo'];
      filas.push({
        hoja,
        nrArticulo: nr == null || nr === '' ? null : formatearNr(nr),
        nombre,
        unidad: unidadBruta as Unidad,
        sd: Number.isFinite(sd) ? sd : 0,
        orden: i,
      });
    });
  }

  return filas;
}

/** Los Nr.Artículo vienen como float (`9.7503113E7`). Se normalizan a entero. */
export function formatearNr(bruto: unknown): string {
  const n = Number(bruto);
  if (!Number.isFinite(n)) return String(bruto).trim();
  return Number.isInteger(n) ? String(n) : String(Math.round(n));
}

/** Catálogo deduplicado por nombre normalizado, como lo hará el seed. */
export function cargarCatalogo(): ArticuloCatalogo[] {
  const porNombre = new Map<string, ArticuloCatalogo>();

  for (const fila of leerFilasStock()) {
    const { normalizado } = descomponerNombre(fila.nombre);
    if (!normalizado) continue;
    if (porNombre.has(normalizado)) {
      // Rellena el Nr.Artículo si una hoja lo trae y otra no.
      const previo = porNombre.get(normalizado)!;
      if (!previo.nrArticulo && fila.nrArticulo) previo.nrArticulo = fila.nrArticulo;
      continue;
    }
    porNombre.set(normalizado, {
      id: `a${porNombre.size + 1}`,
      nrArticulo: fila.nrArticulo,
      nombre: fila.nombre,
      nombreNormalizado: normalizado,
      unidad: fila.unidad,
    });
  }

  return [...porNombre.values()];
}
