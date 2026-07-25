/**
 * Conversión de números hablados en español a valor numérico.
 *
 * Existe porque el reto nace de un error de transcripción numérica: "9 cajas"
 * que termina como 90, un 3 escrito que se lee 5. Todo lo que aquí se resuelve
 * bien es un error que nunca llega al sistema.
 *
 * Sin dependencias: corre igual en el navegador sin red y en la API.
 */

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21,
  veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29,
};

const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90,
};

const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200,
  trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};

/** Fracciones dictadas. `medio kilo` y `dos y medio` son casos reales del live. */
const FRACCIONES: Record<string, number> = {
  medio: 0.5, media: 0.5, mitad: 0.5,
  cuarto: 0.25, cuartos: 0.25, tercio: 1 / 3,
};

/** Palabras que multiplican en vez de sumar. */
const MULTIPLICADORES: Record<string, number> = {
  mil: 1000, miles: 1000, millon: 1_000_000, millones: 1_000_000,
};

export function esPalabraNumero(palabra: string): boolean {
  return (
    palabra in UNIDADES ||
    palabra in DECENAS ||
    palabra in CENTENAS ||
    palabra in MULTIPLICADORES ||
    palabra in FRACCIONES ||
    RE_DIGITOS.test(palabra)
  );
}

/** Acepta `5`, `5.5`, `5,5` (coma decimal colombiana) y `1.250` (miles). */
const RE_DIGITOS = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$|^\d+(?:[.,]\d+)?$/;

/** Convierte un token de dígitos respetando la convención colombiana. */
export function parseDigitos(token: string): number | null {
  if (!RE_DIGITOS.test(token)) return null;
  // 1.250 → mil doscientos cincuenta (punto = separador de miles)
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(token)) {
    return Number(token.replace(/\./g, '').replace(',', '.'));
  }
  return Number(token.replace(',', '.'));
}

export interface ResultadoNumero {
  valor: number;
  /** Cuántos tokens consumió, para que el llamador avance el cursor. */
  consumidos: number;
}

/**
 * Lee un número a partir de `inicio`. Devuelve null si ahí no empieza un número.
 *
 * Maneja la ambigüedad de la "y": en "treinta y cinco" une el número (35), pero
 * en "una caja y tres unidades" separa dos términos. La regla es que la "y" solo
 * continúa el número si lo acumulado terminó en frontera de decena/centena/millar
 * y lo que sigue es otra palabra-número.
 */
export function leerNumero(tokens: string[], inicio: number): ResultadoNumero | null {
  let i = inicio;
  let total = 0;
  let actual = 0;
  let vioAlgo = false;
  let ultimoFueFrontera = false;

  while (i < tokens.length) {
    const t = tokens[i];

    if (t === 'y') {
      // Solo une si venimos de una frontera y lo siguiente es número.
      const sig = tokens[i + 1];
      if (ultimoFueFrontera && sig && (sig in UNIDADES || sig in DECENAS)) {
        i++;
        continue;
      }
      break;
    }

    const digitos = parseDigitos(t);
    if (digitos !== null) {
      actual += digitos;
      vioAlgo = true;
      ultimoFueFrontera = false;
      i++;
      continue;
    }

    if (t in CENTENAS) {
      actual += CENTENAS[t];
      vioAlgo = true;
      ultimoFueFrontera = true;
      i++;
      continue;
    }

    if (t in DECENAS) {
      actual += DECENAS[t];
      vioAlgo = true;
      ultimoFueFrontera = true;
      i++;
      continue;
    }

    if (t in UNIDADES) {
      actual += UNIDADES[t];
      vioAlgo = true;
      ultimoFueFrontera = false;
      i++;
      continue;
    }

    if (t in MULTIPLICADORES) {
      const mult = MULTIPLICADORES[t];
      // "mil" sin nada antes vale 1000; "dos mil" vale 2000.
      total += (actual === 0 ? 1 : actual) * mult;
      actual = 0;
      vioAlgo = true;
      ultimoFueFrontera = true;
      i++;
      continue;
    }

    break;
  }

  if (!vioAlgo) return null;
  return { valor: total + actual, consumidos: i - inicio };
}

/**
 * Lee una fracción suelta: "medio", "un cuarto", "tres cuartos".
 * Se usa tanto al inicio ("medio kilo") como en cola ("dos kilos y medio").
 */
export function leerFraccion(tokens: string[], inicio: number): ResultadoNumero | null {
  const t = tokens[inicio];
  if (!t) return null;

  if (t in FRACCIONES) {
    return { valor: FRACCIONES[t], consumidos: 1 };
  }

  // "tres cuartos", "un cuarto"
  const sig = tokens[inicio + 1];
  if (sig && sig in FRACCIONES && (t in UNIDADES || parseDigitos(t) !== null)) {
    const n = t in UNIDADES ? UNIDADES[t] : parseDigitos(t)!;
    return { valor: n * FRACCIONES[sig], consumidos: 2 };
  }

  return null;
}
