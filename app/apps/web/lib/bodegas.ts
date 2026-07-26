/**
 * Presentacion de la lista de bodegas: agrupado por sitio, tipo y busqueda.
 *
 * Vive aparte de la pantalla a proposito: es logica pura sobre nombres, sin
 * React ni estado, asi que se puede razonar y probar sin montar la interfaz.
 *
 * TODO lo de aqui es PRESENTACION. El nombre real de la bodega no se toca: es
 * lo que viaja a la base, al reporte y al Excel, y la auditoria necesita que
 * coincida byte a byte con el archivo que entrego Colsubsidio. Lo que se
 * arregla aqui es solo lo que ve la persona.
 */
import { quitarAcentos } from '@conteo/core';

export interface BodegaVista {
  id: string;
  /** El nombre ORIGINAL, tal cual vino del archivo. No se muestra. */
  nombre: string;
  articulos: number;
  /** Sitio al que pertenece, ya presentable: "Almacén", "Zoológico". */
  sitio: string;
  /** Etiqueta principal de la fila. */
  titulo: string;
  /** Distintivo, cuando aporta algo que el titulo no dice ya. */
  distintivo: 'AyB' | 'Suministros' | null;
}

/**
 * Tildes que el archivo origen no trae.
 *
 * Se limita a una lista explicita en vez de un acentuador general: adivinar
 * acentos por reglas en nombres propios se equivoca, y aqui solo hay dos
 * palabras afectadas en las ocho bodegas reales. Si aparecen mas, se añaden.
 */
const TILDES: Record<string, string> = {
  ALMACEN: 'Almacén',
  ZOOLOGICO: 'Zoológico',
};

/**
 * "zoologico suministros" -> "Zoológico Suministros".
 *
 * El archivo mezcla mayusculas y minusculas sin criterio: hay bodegas
 * capitalizadas y una entera en minusculas. Con la lista agrupada eso canta.
 *
 * `AyB` se conserva tal cual: es una sigla (alimentos y bebidas), y
 * capitalizarla como palabra daria "Ayb".
 */
export function nombreBonito(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .map((palabra) => {
      const mayus = quitarAcentos(palabra).toUpperCase();
      if (mayus === 'AYB') return 'AyB';
      if (TILDES[mayus]) return TILDES[mayus];
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
    })
    .join(' ');
}

/** El sitio es la primera palabra: los ocho nombres reales lo respetan. */
function sitioDe(nombre: string): string {
  return nombreBonito(nombre.trim().split(/\s+/)[0] ?? nombre);
}

function distintivoDe(nombre: string): 'AyB' | 'Suministros' | null {
  const n = quitarAcentos(nombre).toUpperCase();
  if (/\bAYB\b/.test(n)) return 'AyB';
  if (n.includes('SUMINISTRO')) return 'Suministros';
  return null;
}

/**
 * Prepara una bodega para mostrarla.
 *
 * El titulo evita repetir lo que ya dice el agrupador. Bajo "ALMACÉN", una fila
 * que diga otra vez "Almacén AyB" no informa: lo que distingue a las dos
 * bodegas del sitio es el TIPO. Asi que:
 *
 *   "Kiosco Piscigiros AyB"  -> "Piscigiros"  + distintivo AyB
 *   "Almacen AyB"            -> "Alimentos y bebidas"   (no queda nada mas)
 *   "Almacen Suministros"    -> "Suministros"
 *   "Zoologico"              -> "Zoológico"    (ni resto ni tipo: es lo que hay)
 */
export function prepararBodega(b: {
  id: string;
  nombre: string;
  articulos: number;
}): BodegaVista {
  const sitio = sitioDe(b.nombre);
  const distintivo = distintivoDe(b.nombre);

  // Lo que queda del nombre al quitarle el sitio y el tipo.
  const resto = b.nombre
    .trim()
    .split(/\s+/)
    .slice(1)
    .filter((p) => {
      const m = quitarAcentos(p).toUpperCase();
      return m !== 'AYB' && !m.includes('SUMINISTRO');
    })
    .join(' ');

  const titulo = resto
    ? nombreBonito(resto)
    : distintivo === 'AyB'
      ? 'Alimentos y bebidas'
      : distintivo === 'Suministros'
        ? 'Suministros'
        : sitio;

  return {
    id: b.id,
    nombre: b.nombre,
    articulos: b.articulos,
    sitio,
    titulo,
    // Si el titulo YA es el tipo, el distintivo seria un duplicado.
    distintivo: resto ? distintivo : null,
  };
}

export interface GrupoBodegas {
  sitio: string;
  bodegas: BodegaVista[];
}

/**
 * Filtra por texto y agrupa por sitio.
 *
 * La busqueda va contra el nombre ORIGINAL y sin acentos, asi que encuentra
 * igual escribiendo "zoologico" o "zoológico", y tambien por el tipo
 * ("suministros") o por el resto ("piscigiros"). Con ocho bodegas no hace falta
 * nada mas sofisticado; el catalogo de articulos si tiene su propio motor.
 */
export function agruparBodegas(
  bodegas: { id: string; nombre: string; articulos: number }[],
  busqueda = '',
): GrupoBodegas[] {
  const q = quitarAcentos(busqueda).trim().toUpperCase();
  const grupos = new Map<string, BodegaVista[]>();

  for (const b of bodegas) {
    if (q && !quitarAcentos(b.nombre).toUpperCase().includes(q)) continue;
    const vista = prepararBodega(b);
    const actual = grupos.get(vista.sitio);
    if (actual) actual.push(vista);
    else grupos.set(vista.sitio, [vista]);
  }

  // Se conserva el orden en que llegan del servidor, que ya viene ordenado.
  return [...grupos.entries()].map(([sitio, bs]) => ({ sitio, bodegas: bs }));
}
