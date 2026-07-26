/**
 * Base local (IndexedDB). Es la fuente de verdad del dispositivo mientras no
 * hay red, que en Piscilago es la condicion normal: "no todos los puntos de
 * venta tienen red corporativa del Colsubsidio".
 *
 * Toda captura se escribe AQUI primero y la interfaz responde de inmediato.
 * Nunca hay una llamada de red en el camino critico del conteo.
 */

import Dexie, { type Table } from 'dexie';
import type { ArticuloCatalogo, Unidad } from '@conteo/core';

/** Articulo del catalogo local. Incluye `exp10`, jamas `sd`. */
export interface ArticuloLocal extends ArticuloCatalogo {
  familia: string;
  orden: number;
  /** Orden de magnitud del stock esperado. Permite detectar 9 -> 90 sin red. */
  exp10: number | null;
}

export type TipoCaptura = 'CONTEO' | 'MERMA';

export interface CapturaLocal {
  clientId: string;
  conteoId: string;
  articuloId: string;
  articuloNombre: string;
  cantidad: number;
  unidad: Unidad;
  /** CONTEO si no se dice otra cosa. */
  tipo?: TipoCaptura;
  /** Obligatorio en merma: 'Vencido', 'Dañado o roto', 'Derrame'… */
  motivoMerma?: string | null;
  /** Si el producto dado de baja ya estaba dentro de lo que se contó. */
  incluidoEnConteo?: boolean | null;
  /** URL de la evidencia, una vez subida. */
  fotoUrl?: string | null;
  unidadDicha?: string | null;
  metodo: 'VOZ' | 'TECLADO' | 'CAMARA' | 'BUSQUEDA';
  textoCrudo?: string | null;
  scoreMatch?: number | null;
  anomalias: string[];
  motivoConfirmacion?: string | null;
  capturadoEn: string;
  usuarioNombre: string;
  /** false hasta que el servidor la confirma. */
  sincronizada: boolean;
  /** El servidor pidio recontar (regla R8 evaluada contra el stock real). */
  requiereVerificacion?: string | null;
  enConflicto?: boolean;
}

export interface EnCola {
  clientId: string;
  conteoId: string;
  /** Cuerpo exacto que se enviara. */
  payload: string;
  intentos: number;
  creadoEn: string;
}

export interface Meta {
  clave: string;
  valor: unknown;
}

/**
 * Foto de evidencia esperando a que haya red.
 *
 * Se guarda aparte de la captura porque pesa: la captura viaja en el lote de
 * sincronización y la foto se sube por su cuenta, antes. Así una imagen que
 * falle no bloquea el registro de la merma.
 */
export interface FotoPendiente {
  clientId: string;
  /** Imagen ya comprimida por el navegador, en base64. */
  datos: string;
  tipoContenido: string;
  creadoEn: string;
}

class BaseConteo extends Dexie {
  articulos!: Table<ArticuloLocal, string>;
  capturas!: Table<CapturaLocal, string>;
  cola!: Table<EnCola, string>;
  meta!: Table<Meta, string>;
  fotos!: Table<FotoPendiente, string>;

  constructor() {
    super('conteo-piscilago');
    this.version(1).stores({
      articulos: 'id, nombreNormalizado, familia, orden',
      capturas: 'clientId, conteoId, articuloId, sincronizada, capturadoEn',
      cola: 'clientId, conteoId',
      meta: 'clave',
    });
    // v2 añade las fotos de evidencia. Dexie migra solo; lo ya guardado
    // en la tablet no se pierde.
    this.version(2).stores({
      articulos: 'id, nombreNormalizado, familia, orden',
      capturas: 'clientId, conteoId, articuloId, sincronizada, capturadoEn, tipo',
      cola: 'clientId, conteoId',
      meta: 'clave',
      fotos: 'clientId',
    });
  }
}

export const db = new BaseConteo();

export async function guardarMeta(clave: string, valor: unknown) {
  await db.meta.put({ clave, valor });
}

export async function leerMeta<T>(clave: string): Promise<T | undefined> {
  const fila = await db.meta.get(clave);
  return fila?.valor as T | undefined;
}

/** UUID estable por dispositivo, para poder rastrear que tablet capturo que. */
export async function idDispositivo(): Promise<string> {
  let id = await leerMeta<string>('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    await guardarMeta('deviceId', id);
  }
  return id;
}
