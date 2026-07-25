/**
 * Léxico de unidades habladas → unidad del catálogo.
 *
 * Aquí muere el error que el brief nombra explícitamente:
 * "Si alguien dice 'cinco kilos de harina', no lo confunde con cinco gramos."
 * Gramos y mililitros no se rechazan: se CONVIERTEN y la conversión se muestra
 * en la tarjeta de confirmación, para que el contador vea qué se va a guardar.
 */

import type { Unidad } from './tipos.ts';

export interface UnidadHablada {
  /** Unidad del catálogo a la que mapea. */
  unidad: Unidad;
  /** Factor para llevar la cantidad dicha a la unidad del catálogo. */
  factor: number;
  /** Cómo lo dijo la persona, para la trazabilidad de auditoría. */
  canonica: string;
}

/**
 * Envases sin equivalencia conocida. NO se inventa un factor: el catálogo de
 * Colsubsidio no publica factores de conversión y adivinarlos corrompería el
 * conteo. Se marca y se le pregunta al contador una sola vez por bodega.
 */
export interface EnvaseHablado {
  envase: string;
  /** Factor conocido de antemano (docena, par). null = hay que preguntar. */
  factorConocido: number | null;
}

const LEXICO: Record<string, UnidadHablada> = {};

function registrar(unidad: Unidad, factor: number, canonica: string, ...formas: string[]) {
  for (const f of formas) LEXICO[f] = { unidad, factor, canonica };
}

registrar('Kilogram', 1, 'kilogramos',
  'kilo', 'kilos', 'kilogramo', 'kilogramos', 'kg', 'kgs', 'kilogr');
registrar('Kilogram', 0.001, 'gramos',
  'gramo', 'gramos', 'gr', 'grs', 'g');
registrar('Kilogram', 0.4536, 'libras',
  'libra', 'libras', 'lb', 'lbs');
registrar('Kilogram', 1000, 'toneladas',
  'tonelada', 'toneladas', 'ton');

registrar('Liter', 1, 'litros',
  'litro', 'litros', 'lt', 'lts', 'l');
registrar('Liter', 0.001, 'mililitros',
  'mililitro', 'mililitros', 'ml', 'cc', 'centimetros');

registrar('Unidad', 1, 'unidades',
  'unidad', 'unidades', 'und', 'unds', 'uds', 'ud', 'un',
  'pieza', 'piezas', 'pza', 'pzas', 'item', 'items');

registrar('Portion', 1, 'porciones',
  'porcion', 'porciones', 'porc', 'racion', 'raciones');

/** Envases: cuentan como Unidad, pero el factor no es 1 salvo que se sepa. */
const ENVASES: Record<string, number | null> = {
  docena: 12, docenas: 12,
  par: 2, pares: 2,
  caja: null, cajas: null,
  bulto: null, bultos: null,
  bolsa: null, bolsas: null,
  paquete: null, paquetes: null, paq: null,
  canasta: null, canastas: null, canastilla: null, canastillas: null,
  saco: null, sacos: null,
  paca: null, pacas: null,
  frasco: null, frascos: null, fco: null,
  balde: null, baldes: null,
  garrafa: null, garrafas: null,
  bandeja: null, bandejas: null,
};

export function buscarUnidad(palabra: string): UnidadHablada | null {
  return LEXICO[palabra] ?? null;
}

export function buscarEnvase(palabra: string): EnvaseHablado | null {
  if (!(palabra in ENVASES)) return null;
  return { envase: palabra, factorConocido: ENVASES[palabra] };
}

export function esPalabraUnidad(palabra: string): boolean {
  return palabra in LEXICO || palabra in ENVASES;
}

/**
 * ¿La unidad dicha es compatible con la del catálogo?
 *
 * Si no lo es y no hay conversión, la captura se BLOQUEA y se le muestra al
 * contador en qué unidad mide el catálogo ese artículo. Es la regla R3.
 */
export function unidadCompatible(dicha: Unidad, catalogo: Unidad): boolean {
  return dicha === catalogo;
}
