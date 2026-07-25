/**
 * Parser de enunciados de conteo en español.
 *
 *   "cinco kilos de harina de trigo"      → 5 Kilogram · "harina de trigo"
 *   "medio kilo de arroz"                 → 0.5 Kilogram · "arroz"
 *   "dos kilos y medio de azucar"         → 2.5 Kilogram · "azucar"
 *   "quinientos gramos de mantequilla"    → 0.5 Kilogram · "mantequilla"   (conversión)
 *   "una caja y tres unidades de gaseosa" → 1 caja + 3 Unidad · "gaseosa"
 *   "harina de trigo treinta kilos"       → 30 Kilogram · "harina de trigo"
 *
 * Determinista y sin red: es el camino garantizado cuando la bodega no tiene
 * señal. Gemini solo se invoca como mejora cuando ESTO devuelve baja confianza.
 */

import { quitarAcentos } from './normalizar.ts';
import { leerNumero, leerFraccion, parseDigitos } from './numerosEspanol.ts';
import { buscarUnidad, buscarEnvase, esPalabraUnidad } from './unidades.ts';
import type { Unidad } from './tipos.ts';

/** Muletillas de dictado. No aportan al nombre del artículo. */
const MULETILLAS = new Set([
  'hay', 'tengo', 'tenemos', 'quedan', 'queda', 'registra', 'registrar',
  'registro', 'anota', 'anotar', 'apunta', 'apuntar', 'pon', 'poner',
  'son', 'es', 'este', 'esta', 'esto', 'eh', 'em', 'este', 'o', 'sea',
  'contamos', 'conte', 'cuenta', 'ok', 'listo', 'a', 'ver',
]);

/** Conectores que sí pueden ser parte legítima del nombre ("HARINA DE TRIGO"). */
const CONECTORES = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'para', 'con', 'y']);

export interface TerminoCantidad {
  /** Cantidad ya convertida a la unidad del catálogo. */
  cantidad: number;
  /** Lo que la persona dijo literalmente, antes de convertir. */
  cantidadDicha: number;
  unidad: Unidad | null;
  /** Palabra de unidad tal como se dictó ('gramos'), para auditoría. */
  unidadDicha: string | null;
  factor: number;
  envase: string | null;
  /** true cuando se dijo "caja" y el catálogo no tiene factor de conversión. */
  factorEnvaseDesconocido: boolean;
}

export interface Enunciado {
  terminos: TerminoCantidad[];
  /** Suma de los términos cuando comparten unidad; null si son incompatibles. */
  cantidadTotal: number | null;
  unidad: Unidad | null;
  /**
   * Variantes del nombre del producto, de la más probable a la menos.
   * El matcher las prueba todas y se queda con la de mejor puntaje: así
   * "un balde plastico" no se rompe por leer "balde" como envase.
   */
  variantesProducto: string[];
  /** 0..1 — por debajo de 0.6 se ofrece la ayuda de Gemini si hay red. */
  confianza: number;
  avisos: string[];
  textoCrudo: string;
}

function tokenizar(texto: string): string[] {
  return quitarAcentos(texto)
    .toLowerCase()
    .replace(/[¿?¡!.;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export function parseEnunciado(texto: string): Enunciado {
  const tokens = tokenizar(texto);
  const terminos: TerminoCantidad[] = [];
  const nombre: string[] = [];
  /** Palabras de unidad/envase consumidas: alimentan la variante alterna. */
  const consumidasComoUnidad: string[] = [];
  const avisos: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    // Muletillas fuera, salvo que ya estemos armando el nombre.
    if (MULETILLAS.has(t) && nombre.length === 0) {
      i++;
      continue;
    }

    // La fraccion va PRIMERO: en "tres cuartos", leerNumero se quedaria con el
    // "tres" y dejaria "cuartos" suelto, dando 3 + 0.25 en vez de 0.75.
    const num = leerFraccion(tokens, i) ?? leerNumero(tokens, i);
    if (num) {
      let cantidadDicha = num.valor;
      let j = i + num.consumidos;

      // "dos kilos y medio" → la fracción viene DESPUÉS de la unidad.
      // "dos y medio kilos" → viene antes. Se soportan ambas.
      if (tokens[j] === 'y') {
        const frac = leerFraccion(tokens, j + 1);
        if (frac) {
          cantidadDicha += frac.valor;
          j += 1 + frac.consumidos;
        }
      }

      // ¿Sigue una unidad o un envase?
      let unidad: Unidad | null = null;
      let unidadDicha: string | null = null;
      let factor = 1;
      let envase: string | null = null;
      let factorEnvaseDesconocido = false;

      // "tres cuartos DE litro": la unidad puede venir tras un "de".
      if (tokens[j] === 'de' && tokens[j + 1] && buscarUnidad(tokens[j + 1])) j++;

      const siguiente = tokens[j];
      if (siguiente) {
        const u = buscarUnidad(siguiente);
        if (u) {
          unidad = u.unidad;
          unidadDicha = siguiente;
          factor = u.factor;
          consumidasComoUnidad.push(siguiente);
          j++;
          if (factor !== 1) {
            avisos.push(
              `Se dictó en ${u.canonica}; se guarda en la unidad del catálogo.`,
            );
          }
        } else {
          const e = buscarEnvase(siguiente);
          if (e) {
            envase = e.envase;
            unidadDicha = siguiente;
            consumidasComoUnidad.push(siguiente);
            if (e.factorConocido !== null) {
              unidad = 'Unidad';
              factor = e.factorConocido;
            } else {
              factorEnvaseDesconocido = true;
            }
            j++;
          }
        }
      }

      // "dos kilos y medio": fracción después de la unidad.
      if (tokens[j] === 'y') {
        const frac = leerFraccion(tokens, j + 1);
        if (frac) {
          cantidadDicha += frac.valor;
          j += 1 + frac.consumidos;
        }
      }

      terminos.push({
        cantidad: redondear(cantidadDicha * factor),
        cantidadDicha,
        unidad,
        unidadDicha,
        factor,
        envase,
        factorEnvaseDesconocido,
      });

      i = j;
      continue;
    }

    // Palabra de unidad suelta sin número delante: se ignora para el nombre
    // pero se guarda por si en realidad era parte del producto.
    if (esPalabraUnidad(t) && nombre.length === 0 && terminos.length > 0) {
      consumidasComoUnidad.push(t);
      i++;
      continue;
    }

    nombre.push(t);
    i++;
  }

  // Variantes del nombre, de más probable a menos.
  const base = limpiarNombre(nombre);
  const variantes: string[] = [];
  if (base) variantes.push(base);
  if (consumidasComoUnidad.length > 0) {
    const conUnidades = limpiarNombre([...consumidasComoUnidad, ...nombre]);
    if (conUnidades && conUnidades !== base) variantes.push(conUnidades);
  }
  if (variantes.length === 0 && consumidasComoUnidad.length > 0) {
    variantes.push(limpiarNombre(consumidasComoUnidad));
  }

  const { cantidadTotal, unidad } = consolidar(terminos);

  if (terminos.some((t) => t.factorEnvaseDesconocido)) {
    avisos.push(
      'El catálogo no tiene factor de conversión para ese empaque. Confirma cuántas unidades trae.',
    );
  }

  return {
    terminos,
    cantidadTotal,
    unidad,
    variantesProducto: variantes,
    confianza: calcularConfianza(terminos, variantes),
    avisos,
    textoCrudo: texto,
  };
}

function limpiarNombre(tokens: string[]): string {
  const filtrados = tokens.filter((t) => !MULETILLAS.has(t));
  // Quita conectores sueltos al inicio y al final; los del medio se conservan
  // porque "HARINA DE TRIGO" los necesita.
  while (filtrados.length && CONECTORES.has(filtrados[0])) filtrados.shift();
  while (filtrados.length && CONECTORES.has(filtrados[filtrados.length - 1])) filtrados.pop();
  return filtrados.join(' ').trim();
}

function consolidar(terminos: TerminoCantidad[]): {
  cantidadTotal: number | null;
  unidad: Unidad | null;
} {
  if (terminos.length === 0) return { cantidadTotal: null, unidad: null };

  const conUnidad = terminos.filter((t) => t.unidad !== null);
  const unidades = new Set(conUnidad.map((t) => t.unidad));

  // Términos con envase sin factor no se pueden sumar todavía.
  const sumables = terminos.filter((t) => !t.factorEnvaseDesconocido);

  if (unidades.size > 1) return { cantidadTotal: null, unidad: null };

  const unidad = conUnidad[0]?.unidad ?? null;
  if (sumables.length === 0) return { cantidadTotal: null, unidad };

  const total = sumables.reduce((acc, t) => acc + t.cantidad, 0);
  return { cantidadTotal: redondear(total), unidad };
}

function calcularConfianza(terminos: TerminoCantidad[], variantes: string[]): number {
  let c = 0;
  if (terminos.length > 0) c += 0.4;
  if (terminos.some((t) => t.unidad !== null)) c += 0.3;
  if (variantes.length > 0 && variantes[0].length >= 3) c += 0.3;
  if (terminos.some((t) => t.factorEnvaseDesconocido)) c -= 0.2;
  if (terminos.length > 2) c -= 0.1;
  return Math.max(0, Math.min(1, c));
}

/** 3 decimales: suficiente para medio kilo y para 0.001 kg (= 1 gramo). */
function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export { parseDigitos };
