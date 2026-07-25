/**
 * Normalizacion de nombres de articulo.
 *
 * Calibrada contra la suciedad REAL de `datos/BODEGAS Y STOCK.xlsx`:
 *  - espacios no-rompibles (U+00A0) al inicio del nombre, p.ej. en
 *    "BALDE PLASTICO 10 LTS" y "CUCHARA PORCIONADORA DE 6 ONZAS".
 *  - y tambien EN MEDIO de un token, haciendo de espacio faltante:
 *    "BOLSA BLANCA RESD APROV<U+00A0>90X110 CAL 2". Por eso se CONVIERTEN a
 *    espacio, no se borran: borrarlos pegaria dos palabras distintas.
 *  - espacios sobrantes y dobles: " CAZUELA 16 ONZ".
 *  - prefijos de clasificacion interna: "AFVT) ANTIMICROBIANO FRUTAS Y VERDURAS".
 *  - sufijos entre parentesis: "PORCION CADERA X 180 GR (PA)".
 *  - acentos inconsistentes entre el catalogo y lo que se dicta.
 *
 * Los regex de rangos Unicode se construyen con `new RegExp` a partir de
 * cadenas ASCII: escribir los caracteres literales en el fuente los vuelve
 * invisibles y frágiles ante cualquier editor que normalice el archivo.
 */

/** Prefijo tipo `AFVT)` o `AB)` al comienzo del nombre. */
const RE_PREFIJO_CODIGO = /^\s*([A-Z]{2,6})\)\s*/;

/** Sufijo entre parentesis al final: `(PA)`, `(USO ZOOLOGICO)`. */
const RE_SUFIJO_PARENTESIS = /\s*\(([^)]*)\)\s*$/;

/**
 * Cualquier variedad de espacio Unicode: los de `\s`, el no-rompible (00A0),
 * el ogham (1680), los tipograficos (2000-200A), separadores de linea y
 * parrafo (2028/2029), el estrecho no-rompible (202F), el matematico (205F),
 * el ideografico (3000) y la BOM (FEFF), que aparece pegada en exports de Excel.
 */
const RE_ESPACIOS = new RegExp(
  '[\\s\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+',
  'g',
);

/** Marcas diacriticas combinantes que deja la descomposicion NFD. */
const RE_DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Puntuacion que separa tokens: "PLAS.13" son dos cosas, no una. */
const RE_PUNTUACION = /[.,;:_/\\"'*+()[\]{}]/g;

/**
 * Quita acentos y diacriticos, incluida la tilde de la enye.
 *
 * La enye se colapsa a "n" a proposito: nadie dicta ni teclea la tilde, y como
 * el catalogo pasa por esta misma funcion, "JALAPENOS" con y sin tilde terminan
 * siendo la misma llave. Es justo lo que se necesita para comparar.
 */
export function quitarAcentos(texto: string): string {
  return (texto ?? '').normalize('NFD').replace(RE_DIACRITICOS, '').normalize('NFC');
}

export interface NombreDescompuesto {
  /** Nombre limpio, en MAYUSCULAS, sin acentos: la llave de comparacion. */
  normalizado: string;
  /** Prefijo de clasificacion extraido, si existia (`AFVT`). */
  prefijo: string | null;
  /** Contenido del parentesis final, si existia (`PA`, `USO ZOOLOGICO`). */
  calificador: string | null;
}

/**
 * Descompone un nombre de catalogo en su forma comparable + las piezas que se
 * apartan. El prefijo y el calificador NO se tiran: sirven como tokens
 * secundarios de desempate cuando dos articulos coinciden en el nombre base.
 */
export function descomponerNombre(bruto: string): NombreDescompuesto {
  let texto = (bruto ?? '').replace(RE_ESPACIOS, ' ').trim();

  let prefijo: string | null = null;
  const mPrefijo = texto.match(RE_PREFIJO_CODIGO);
  if (mPrefijo) {
    prefijo = mPrefijo[1];
    texto = texto.slice(mPrefijo[0].length);
  }

  let calificador: string | null = null;
  const mSufijo = texto.match(RE_SUFIJO_PARENTESIS);
  if (mSufijo && mSufijo.index !== undefined) {
    calificador = normalizar(mSufijo[1]);
    texto = texto.slice(0, mSufijo.index).trim();
  }

  return { normalizado: normalizar(texto), prefijo, calificador };
}

/** Forma canonica para comparar: sin acentos, MAYUSCULAS, espacios colapsados. */
export function normalizar(texto: string): string {
  return quitarAcentos(texto ?? '')
    .replace(RE_ESPACIOS, ' ')
    .replace(RE_PUNTUACION, ' ')
    .replace(RE_ESPACIOS, ' ')
    .trim()
    .toUpperCase();
}

/** Tokens significativos de un nombre ya normalizado. */
export function tokenizar(normalizado: string): string[] {
  return normalizado.split(' ').filter((t) => t.length > 0);
}
