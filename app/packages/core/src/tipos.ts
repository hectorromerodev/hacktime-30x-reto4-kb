/**
 * Tipos compartidos entre el navegador (offline) y la API.
 *
 * Regla de oro del dominio: el conteo es CIEGO. En ningún tipo que viaje al
 * cliente existe el campo `sd` (stock del sistema). Ver `ArticuloCatalogo`.
 */

/** Las cuatro unidades que realmente aparecen en BODEGAS Y STOCK.xlsx. */
export type Unidad = 'Unidad' | 'Kilogram' | 'Liter' | 'Portion';

export const UNIDADES: readonly Unidad[] = ['Unidad', 'Kilogram', 'Liter', 'Portion'];

/** Etiqueta legible en español para mostrar al contador. */
export const ETIQUETA_UNIDAD: Record<Unidad, { singular: string; plural: string; corta: string }> = {
  Unidad: { singular: 'unidad', plural: 'unidades', corta: 'un' },
  Kilogram: { singular: 'kilogramo', plural: 'kilogramos', corta: 'kg' },
  Liter: { singular: 'litro', plural: 'litros', corta: 'L' },
  Portion: { singular: 'porción', plural: 'porciones', corta: 'porc' },
};

export function etiquetaUnidad(unidad: Unidad, cantidad: number): string {
  const e = ETIQUETA_UNIDAD[unidad];
  return Math.abs(cantidad) === 1 ? e.singular : e.plural;
}

/**
 * Artículo tal como lo recibe el dispositivo del contador.
 * NO incluye `sd` a propósito: el conteo ciego es una propiedad del contrato,
 * no una regla de UI que se pueda olvidar.
 */
export interface ArticuloCatalogo {
  id: string;
  nrArticulo: string | null;
  nombre: string;
  /** Precalculado en el servidor para no recalcular 936 veces en el cliente. */
  nombreNormalizado: string;
  unidad: Unidad;
}

export type MetodoCaptura = 'VOZ' | 'TECLADO' | 'CAMARA' | 'BUSQUEDA';

export type EstadoCaptura = 'OK' | 'EN_CONFLICTO' | 'ANULADA';

export interface Captura {
  /** UUID generado en el dispositivo. Llave de idempotencia del sync. */
  clientId: string;
  conteoId: string;
  articuloId: string;
  cantidad: number;
  unidad: Unidad;
  metodo: MetodoCaptura;
  /** Transcripción cruda de voz o texto tecleado. Insumo para auditoría. */
  textoCrudo?: string | null;
  scoreMatch?: number | null;
  anomalias: CodigoAnomalia[];
  creadoEn: string;
}

export type CodigoAnomalia =
  | 'R1_DECIMAL_EN_UNIDAD'
  | 'R2_NEGATIVO'
  | 'R3_UNIDAD_DISCORDANTE'
  | 'R4_MATCH_DEBIL'
  | 'R5_CERO_EXPLICITO'
  | 'R6_MAGNITUD_ABSURDA'
  | 'R7_DUPLICADO_EN_SESION'
  | 'R8_SALTO_DE_MAGNITUD'
  | 'R9_ENVASE_SIN_FACTOR';

export type SeveridadAnomalia = 'BLOQUEO' | 'CONFIRMAR' | 'AVISO';
