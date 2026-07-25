/**
 * Motor de coincidencia de artículos. El problema técnico central del reto:
 * Colsubsidio confirmó que "no todos los productos tienen un ID único", así que
 * el nombre ES la llave y hay que acertarle con voz ruidosa y catálogo sucio.
 *
 * Corre 100% en el dispositivo, sin red: 936 artículos, índice invertido, ~15ms
 * de construcción y consultas por debajo del milisegundo.
 *
 * Dos hechos del dataset real mandan sobre el diseño:
 *
 *  1. Los nombres vienen TRUNCADOS a 40 caracteres por el sistema origen
 *     (51 nombres miden exactamente 40 vs. una distribución suave alrededor):
 *     'ARCHIVADOR FUELLE OFICIO PLAS.13 BOLSILL' perdió su cola. Por eso el
 *     puntaje mide cuánto de la CONSULTA cubre el candidato, nunca al revés:
 *     una métrica simétrica castigaría al candidato por lo que le cortaron.
 *
 *  2. Los tokens numéricos discriminan de verdad. 'PORCION DE CADERA X 100 GRS'
 *     y 'PORCION DE CADERA X 130 GRS' son artículos distintos con costo distinto.
 *     Un motor de typos los trata como casi iguales; aquí se penaliza explícito.
 */

import { descomponerNombre, normalizar, tokenizar } from './normalizar.ts';
import type { ArticuloCatalogo } from './tipos.ts';

/** Palabras vacías: no entran al índice pero se conservan para mostrar. */
const VACIAS = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'EN', 'PARA', 'CON', 'Y', 'A', 'AL']);

/** Tokens de empaque/medida. Aportan poco: 'X 50 UN' aparece por todas partes. */
const PACK = new Set([
  'X', 'UN', 'UND', 'UNDS', 'UDS', 'CJ', 'CJX', 'PTE', 'PAQ', 'PAQX', 'FCO', 'FCOX',
  'TBOX', 'LT', 'LTS', 'CC', 'ML', 'GR', 'GRS', 'G', 'KG', 'MG', 'OZ', 'ONZ', 'ONZAS',
  'CM', 'MM', 'MIC', 'CAL', 'PULG', 'REF', 'NAC', 'PA', 'BLS', 'BOL',
]);

/** `CJX50`, `TBOX20G`, `FCOX8ML`: código de empaque pegado al número. */
const RE_PACK_COMPUESTO = /^[A-Z]{1,4}\d+[A-Z]*\d*$/;
const RE_NUMERO = /^\d+(?:[.,]\d+)?$/;

type ClaseToken = 'CONTENIDO' | 'NUMERO' | 'PACK' | 'VACIA';

function clasificar(token: string): ClaseToken {
  if (VACIAS.has(token)) return 'VACIA';
  if (RE_NUMERO.test(token)) return 'NUMERO';
  if (PACK.has(token) || RE_PACK_COMPUESTO.test(token)) return 'PACK';
  return 'CONTENIDO';
}

export interface ArticuloIndexado {
  articulo: ArticuloCatalogo;
  /** Solo tokens de contenido, unidos. Es lo que se compara. */
  norm: string;
  tokens: string[];
  numeros: string[];
  etiquetas: string[];
  bigramas: Set<string>;
  /** Existe stock de este artículo en la bodega que se está contando. */
  enBodega: boolean;
}

export interface Indice {
  items: ArticuloIndexado[];
  porToken: Map<string, number[]>;
  porPrefijo: Map<string, number[]>;
  porBigrama: Map<string, number[]>;
}

function bigramas(texto: string): Set<string> {
  const s = texto.replace(/ /g, '');
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [chico, grande] = a.size < b.size ? [a, b] : [b, a];
  for (const g of chico) if (grande.has(g)) inter++;
  return (2 * inter) / (a.size + b.size);
}

function agregar(mapa: Map<string, number[]>, clave: string, idx: number) {
  const lista = mapa.get(clave);
  if (lista) lista.push(idx);
  else mapa.set(clave, [idx]);
}

/** Construye el índice una sola vez, al cargar el catálogo de la bodega. */
export function construirIndice(articulos: ArticuloCatalogo[]): Indice {
  const items: ArticuloIndexado[] = [];
  const porToken = new Map<string, number[]>();
  const porPrefijo = new Map<string, number[]>();
  const porBigrama = new Map<string, number[]>();

  articulos.forEach((articulo, idx) => {
    const desc = descomponerNombre(articulo.nombre);
    const todos = tokenizar(desc.normalizado);

    const contenido: string[] = [];
    const numeros: string[] = [];
    for (const t of todos) {
      const clase = clasificar(t);
      if (clase === 'CONTENIDO') contenido.push(t);
      else if (clase === 'NUMERO') numeros.push(t.replace(',', '.'));
    }

    const etiquetas: string[] = [];
    if (desc.prefijo) etiquetas.push(desc.prefijo);
    if (desc.calificador) etiquetas.push(desc.calificador);

    const norm = contenido.join(' ');
    const item: ArticuloIndexado = {
      articulo,
      norm,
      tokens: contenido,
      numeros,
      etiquetas,
      bigramas: bigramas(norm),
      enBodega: true,
    };
    items.push(item);

    for (const t of contenido) {
      agregar(porToken, t, idx);
      if (t.length >= 3) agregar(porPrefijo, t.slice(0, 3), idx);
    }
    for (const bg of item.bigramas) agregar(porBigrama, bg, idx);
  });

  return { items, porToken, porPrefijo, porBigrama };
}

export interface Candidato {
  articulo: ArticuloCatalogo;
  score: number;
  /** Tokens del candidato que la consulta NO mencionó: lo que lo diferencia. */
  tokensDiferenciadores: string[];
  /** Tokens compartidos con la consulta. */
  tokensCompartidos: string[];
}

export interface OpcionesBusqueda {
  limite?: number;
  /** IDs ya contados en esta sesión: bajan de prioridad, no desaparecen. */
  yaContados?: Set<string>;
}

/**
 * Qué tanto de la CONSULTA cubre el candidato. Asimétrico a propósito por el
 * truncamiento a 40 caracteres: al candidato le falta cola, no le sobra.
 */
function cobertura(
  tokensConsulta: string[],
  tokensCandidato: string[],
): { valor: number; compartidos: string[] } {
  if (tokensConsulta.length === 0) return { valor: 0, compartidos: [] };

  let pesoTotal = 0;
  let puntajeTotal = 0;
  const compartidos: string[] = [];

  for (const q of tokensConsulta) {
    const peso = Math.max(1, q.length);
    pesoTotal += peso;

    let mejor = 0;
    let mejorToken = '';
    for (const c of tokensCandidato) {
      let s = 0;
      if (c === q) s = 1;
      else if (q.length >= 3 && c.startsWith(q)) s = 0.9;
      // El candidato truncado puede ser prefijo de lo que dijo la persona.
      else if (c.length >= 3 && q.startsWith(c)) s = 0.85;
      else {
        const d = dice(bigramas(q), bigramas(c));
        if (d >= 0.6) s = d * 0.9;
      }
      if (s > mejor) {
        mejor = s;
        mejorToken = c;
      }
    }
    puntajeTotal += mejor * peso;
    if (mejor >= 0.85 && mejorToken) compartidos.push(mejorToken);
  }

  return { valor: puntajeTotal / pesoTotal, compartidos };
}

/**
 * Acuerdo numérico. Devuelve el puntaje y si hay contradicción explícita
 * (la consulta dijo 130 y el candidato dice 100 → son artículos distintos).
 */
function acuerdoNumerico(
  numsConsulta: string[],
  numsCandidato: string[],
): { valor: number; contradice: boolean } {
  if (numsConsulta.length === 0) return { valor: 0.5, contradice: false };
  if (numsCandidato.length === 0) return { valor: 0.4, contradice: false };

  const set = new Set(numsCandidato);
  const coinciden = numsConsulta.filter((n) => set.has(n)).length;
  if (coinciden === numsConsulta.length) return { valor: 1, contradice: false };
  if (coinciden === 0) return { valor: 0, contradice: true };
  return { valor: coinciden / numsConsulta.length, contradice: false };
}

/** Busca los mejores artículos para un texto (dictado o tecleado). */
export function buscar(
  indice: Indice,
  consulta: string,
  opciones: OpcionesBusqueda = {},
): Candidato[] {
  const limite = opciones.limite ?? 5;
  const norm = normalizar(consulta);
  if (!norm) return [];

  const todos = tokenizar(norm);
  const tokensConsulta: string[] = [];
  const numsConsulta: string[] = [];
  for (const t of todos) {
    const clase = clasificar(t);
    if (clase === 'CONTENIDO') tokensConsulta.push(t);
    else if (clase === 'NUMERO') numsConsulta.push(t.replace(',', '.'));
  }
  if (tokensConsulta.length === 0 && numsConsulta.length === 0) return [];

  // --- Recuperación: solo se puntúa un puñado de candidatos, no los 936.
  const candidatos = new Set<number>();
  for (const t of tokensConsulta) {
    for (const idx of indice.porToken.get(t) ?? []) candidatos.add(idx);
    if (t.length >= 3) {
      for (const idx of indice.porPrefijo.get(t.slice(0, 3)) ?? []) candidatos.add(idx);
    }
  }
  // Red de seguridad para dictados muy deformados: ningún token pegó.
  if (candidatos.size < 5) {
    const conteo = new Map<number, number>();
    for (const bg of bigramas(norm)) {
      for (const idx of indice.porBigrama.get(bg) ?? []) {
        conteo.set(idx, (conteo.get(idx) ?? 0) + 1);
      }
    }
    [...conteo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .forEach(([idx]) => candidatos.add(idx));
  }

  const consultaBigramas = bigramas(tokensConsulta.join(' '));
  const resultados: Candidato[] = [];

  for (const idx of candidatos) {
    const item = indice.items[idx];

    const d = dice(consultaBigramas, item.bigramas);
    const cob = cobertura(tokensConsulta, item.tokens);
    const num = acuerdoNumerico(numsConsulta, item.numeros);

    let score = 0.45 * d + 0.35 * cob.valor + 0.1 * num.valor;

    // El primer token es el sustantivo principal: 'BOLSA', 'ACEITE', 'HARINA'.
    if (tokensConsulta[0] && item.tokens[0] === tokensConsulta[0]) score += 0.06;
    // Igualdad exacta tras normalizar: no hay nada que dudar.
    if (item.norm === tokensConsulta.join(' ')) score = Math.max(score, 0.97);
    // Un número contradicho cambia el artículo, no lo aproxima.
    if (num.contradice) score -= 0.25;
    // Lo ya contado baja, pero sigue disponible para recuento.
    if (opciones.yaContados?.has(item.articulo.id)) score -= 0.08;

    if (score <= 0.05) continue;

    const compartidos = new Set(cob.compartidos);
    resultados.push({
      articulo: item.articulo,
      score: Math.max(0, Math.min(1, score)),
      tokensCompartidos: [...compartidos],
      tokensDiferenciadores: item.tokens.filter((t) => !compartidos.has(t)),
    });
  }

  resultados.sort((a, b) => b.score - a.score);
  return resultados.slice(0, limite);
}

export type Decision = 'AUTO' | 'ELEGIR' | 'BUSCAR';

/**
 * Política de decisión. Deliberadamente conservadora: equivocarse eligiendo
 * entre cuatro tarjetas es casi imposible, pero un auto-aceptado errado entra
 * sucio al sistema, que es justo lo que el reto pide eliminar.
 */
export function decidir(candidatos: Candidato[]): Decision {
  if (candidatos.length === 0) return 'BUSCAR';
  const top1 = candidatos[0].score;
  const top2 = candidatos[1]?.score ?? 0;
  if (top1 >= 0.82 && top1 - top2 >= 0.15) return 'AUTO';
  if (top1 >= 0.55) return 'ELEGIR';
  return 'BUSCAR';
}

/**
 * Elige la mejor hipótesis del reconocedor de voz usando el catálogo.
 *
 * El ASR no conoce el inventario de Piscilago; el índice sí. Si Google entrega
 * "cinco kilos de arena" como primera opción y "cinco kilos de harina" como
 * tercera, gana harina porque existe en la bodega. Veinte líneas que arreglan
 * una clase entera de errores de dictado.
 */
export function elegirMejorHipotesis(
  indice: Indice,
  hipotesis: string[],
  extraerProducto: (texto: string) => string[],
): { hipotesis: string; candidatos: Candidato[] } | null {
  let mejor: { hipotesis: string; candidatos: Candidato[]; score: number } | null = null;

  for (const h of hipotesis) {
    for (const variante of extraerProducto(h)) {
      const candidatos = buscar(indice, variante, { limite: 5 });
      const score = candidatos[0]?.score ?? 0;
      if (!mejor || score > mejor.score) mejor = { hipotesis: h, candidatos, score };
    }
  }

  return mejor ? { hipotesis: mejor.hipotesis, candidatos: mejor.candidatos } : null;
}
