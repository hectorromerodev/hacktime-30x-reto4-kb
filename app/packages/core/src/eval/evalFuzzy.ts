/**
 * Evaluación del matcher contra el catálogo real (936 artículos).
 *
 * No es un test de humo: es la medición que convierte "hicimos fuzzy matching"
 * en un número defendible. Simula las seis formas en que una consulta real se
 * desvía del nombre del catálogo — dictado parcial, typos del ASR, orden
 * invertido, sin códigos de empaque — y reporta accuracy@1 y accuracy@5.
 *
 *   node --experimental-strip-types src/eval/evalFuzzy.ts
 *
 * Umbral de aceptación del proyecto: accuracy@5 >= 90%.
 */

import { cargarCatalogo } from './cargarFixture.ts';
import { construirIndice, buscar, decidir } from '../fuzzy.ts';
import { descomponerNombre, tokenizar } from '../normalizar.ts';

const PACK = new Set([
  'X', 'UN', 'UND', 'UNDS', 'UDS', 'CJ', 'PTE', 'PAQ', 'FCO', 'LT', 'LTS', 'CC',
  'ML', 'GR', 'GRS', 'G', 'KG', 'MG', 'OZ', 'ONZ', 'ONZAS', 'CM', 'MM', 'MIC',
  'CAL', 'PULG', 'REF', 'NAC', 'PA',
]);

const VACIAS = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'EN', 'PARA', 'CON', 'Y']);

function contenido(nombre: string): string[] {
  return tokenizar(descomponerNombre(nombre).normalizado).filter(
    (t) => !PACK.has(t) && !VACIAS.has(t) && !/^\d+([.,]\d+)?$/.test(t) && !/^[A-Z]{1,4}\d/.test(t),
  );
}

/** Intercambia dos caracteres contiguos: el typo más común al teclear. */
function transponer(texto: string, semilla: number): string {
  const letras = texto.split('');
  if (letras.length < 4) return texto;
  const i = 1 + (semilla % (letras.length - 2));
  [letras[i], letras[i + 1]] = [letras[i + 1], letras[i]];
  return letras.join('');
}

/** Borra una letra: simula el recorte del ASR al final de una palabra. */
function borrarLetra(texto: string, semilla: number): string {
  if (texto.length < 5) return texto;
  const i = 1 + (semilla % (texto.length - 2));
  return texto.slice(0, i) + texto.slice(i + 1);
}

interface Mutacion {
  nombre: string;
  generar: (nombre: string, i: number) => string | null;
}

const MUTACIONES: Mutacion[] = [
  {
    nombre: 'exacto',
    generar: (n) => n,
  },
  {
    nombre: 'sin empaque ni números',
    generar: (n) => contenido(n).join(' ') || null,
  },
  {
    nombre: 'dictado parcial (2 primeras palabras)',
    generar: (n) => {
      const t = contenido(n);
      return t.length >= 2 ? t.slice(0, 2).join(' ') : null;
    },
  },
  {
    nombre: 'typo por transposición',
    generar: (n, i) => {
      const t = contenido(n);
      if (t.length === 0) return null;
      const j = i % t.length;
      const copia = [...t];
      copia[j] = transponer(copia[j], i);
      return copia.join(' ');
    },
  },
  {
    nombre: 'letra faltante (recorte de ASR)',
    generar: (n, i) => {
      const t = contenido(n);
      if (t.length === 0) return null;
      const j = i % t.length;
      const copia = [...t];
      copia[j] = borrarLetra(copia[j], i);
      return copia.join(' ');
    },
  },
  {
    nombre: 'orden invertido',
    generar: (n) => {
      const t = contenido(n);
      return t.length >= 2 ? [...t].reverse().join(' ') : null;
    },
  },
  {
    nombre: 'minúsculas sin acentos',
    generar: (n) => contenido(n).join(' ').toLowerCase() || null,
  },
];

function main() {
  const catalogo = cargarCatalogo();
  const t0 = performance.now();
  const indice = construirIndice(catalogo);
  const msIndice = performance.now() - t0;

  console.log(`Catálogo: ${catalogo.length} artículos`);
  console.log(`Índice construido en ${msIndice.toFixed(1)} ms`);
  console.log(`Tokens indexados: ${indice.porToken.size}\n`);

  let totalGlobal = 0;
  let top1Global = 0;
  let top5Global = 0;
  let msTotal = 0;
  let consultas = 0;
  const fallos: { consulta: string; esperado: string; obtenido: string }[] = [];
  let autoCorrectos = 0;
  let autoTotal = 0;

  console.log('| Mutación | n | acc@1 | acc@5 |');
  console.log('|---|---:|---:|---:|');

  for (const mut of MUTACIONES) {
    let n = 0;
    let a1 = 0;
    let a5 = 0;

    catalogo.forEach((art, i) => {
      const consulta = mut.generar(art.nombre, i);
      if (!consulta || consulta.trim().length < 2) return;
      n++;

      const t = performance.now();
      const res = buscar(indice, consulta, { limite: 5 });
      msTotal += performance.now() - t;
      consultas++;

      const pos = res.findIndex((c) => c.articulo.id === art.id);
      if (pos === 0) a1++;
      if (pos >= 0 && pos < 5) a5++;
      else if (fallos.length < 12) {
        fallos.push({
          consulta,
          esperado: art.nombre.trim(),
          obtenido: res[0]?.articulo.nombre.trim() ?? '(nada)',
        });
      }

      // ¿Cuando el motor decide auto-aceptar, acierta?
      if (decidir(res) === 'AUTO') {
        autoTotal++;
        if (pos === 0) autoCorrectos++;
      }
    });

    totalGlobal += n;
    top1Global += a1;
    top5Global += a5;
    console.log(
      `| ${mut.nombre} | ${n} | ${pct(a1, n)} | ${pct(a5, n)} |`,
    );
  }

  const acc1 = top1Global / totalGlobal;
  const acc5 = top5Global / totalGlobal;

  console.log(`\nGLOBAL  acc@1 = ${pct(top1Global, totalGlobal)}   acc@5 = ${pct(top5Global, totalGlobal)}`);
  console.log(`Latencia media por consulta: ${(msTotal / consultas).toFixed(3)} ms`);
  console.log(
    `Precisión del auto-aceptado: ${pct(autoCorrectos, autoTotal)} sobre ${autoTotal} casos`,
  );

  if (fallos.length) {
    console.log('\nEjemplos de fallo (no estaba en el top 5):');
    for (const f of fallos) {
      console.log(`  consulta : ${f.consulta}`);
      console.log(`  esperado : ${f.esperado}`);
      console.log(`  obtenido : ${f.obtenido}\n`);
    }
  }

  const UMBRAL = 0.9;
  if (acc5 < UMBRAL) {
    console.error(`\n✗ acc@5 ${(acc5 * 100).toFixed(1)}% por debajo del umbral ${UMBRAL * 100}%`);
    process.exit(1);
  }
  console.log(`\n✓ acc@5 ${(acc5 * 100).toFixed(1)}% cumple el umbral del ${UMBRAL * 100}%`);
  void acc1;
}

function pct(a: number, b: number): string {
  return b === 0 ? '—' : `${((a / b) * 100).toFixed(1)}%`;
}

main();
