/**
 * Captura por voz.
 *
 * ── Honestidad tecnica, dicha de frente ──
 * El navegador NO tiene reconocimiento de voz offline real. La Web Speech API
 * de Chrome manda el audio a servidores de Google; un modelo local (Whisper o
 * Vosk en WASM) pesa 40 MB o mas.
 *
 * Por eso la arquitectura NO depende de la voz: la captura por teclado y
 * busqueda funciona 100% sin red, y la voz es un acelerador que se apaga solo
 * cuando no hay senal. Un demo que se rompe dentro de una bodega sin cobertura
 * seria peor que no tener voz.
 *
 * El truco que si aporta valor: se piden 5 hipotesis al reconocedor y se elige
 * la que mejor puntua CONTRA EL CATALOGO. El reconocedor no sabe que hay en
 * Piscilago; el indice si. "cinco kilos de arena" pierde contra "cinco kilos de
 * harina" porque HARINA existe en la bodega y ARENA no.
 */

import { parseEnunciado, buscar, type Indice, type Candidato } from '@conteo/core';

export interface ResultadoVoz {
  transcripcion: string;
  /** Todas las hipotesis que devolvio el reconocedor, para trazabilidad. */
  hipotesis: string[];
  candidatos: Candidato[];
  cantidad: number | null;
  unidad: string | null;
  unidadDicha: string | null;
  avisos: string[];
  envaseSinFactor: string | null;
}

type Reconocedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

interface SpeechRecognitionEventLike {
  results: ArrayLike<
    ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }
  >;
}

function constructor(): (new () => Reconocedor) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Reconocedor) | null;
}

export function vozDisponible(): boolean {
  return constructor() !== null;
}

/**
 * @returns una funcion para detener la escucha (soltar el boton).
 */
export function escuchar(
  indice: Indice,
  alTerminar: (r: ResultadoVoz) => void,
  alParcial?: (texto: string) => void,
  alError?: (mensaje: string) => void,
): () => void {
  const Ctor = constructor();
  if (!Ctor) {
    alError?.('Este navegador no reconoce voz. Usa el teclado.');
    return () => {};
  }

  const rec = new Ctor();
  rec.lang = 'es-CO';
  rec.continuous = false;
  rec.interimResults = true;
  // Cinco hipotesis: el re-ranking contra el catalogo necesita alternativas.
  rec.maxAlternatives = 5;

  let entregado = false;

  rec.onresult = (evento) => {
    const ultimo = evento.results[evento.results.length - 1];
    if (!ultimo) return;

    if (!ultimo.isFinal) {
      alParcial?.(ultimo[0]?.transcript ?? '');
      return;
    }

    const hipotesis: string[] = [];
    for (let i = 0; i < ultimo.length; i++) {
      const t = ultimo[i]?.transcript?.trim();
      if (t) hipotesis.push(t);
    }
    if (hipotesis.length === 0) return;

    entregado = true;
    alTerminar(interpretar(indice, hipotesis));
  };

  rec.onerror = (e) => {
    if (e.error === 'no-speech') alError?.('No se escucho nada. Intenta otra vez.');
    else if (e.error === 'not-allowed') alError?.('Falta permiso de microfono.');
    else if (e.error === 'network') alError?.('Sin red: la voz no esta disponible. Usa el teclado.');
    else alError?.('No se pudo capturar la voz. Usa el teclado.');
  };

  rec.onend = () => {
    if (!entregado) alParcial?.('');
  };

  try {
    rec.start();
  } catch {
    alError?.('No se pudo iniciar el microfono.');
  }

  return () => {
    try {
      rec.stop();
    } catch {
      /* ya estaba detenido */
    }
  };
}

/**
 * Convierte las hipotesis en un resultado estructurado.
 * Exportada aparte para poder probarla sin microfono.
 */
export function interpretar(indice: Indice, hipotesis: string[]): ResultadoVoz {
  let mejor: {
    texto: string;
    candidatos: Candidato[];
    score: number;
    parse: ReturnType<typeof parseEnunciado>;
  } | null = null;

  for (const texto of hipotesis) {
    const parse = parseEnunciado(texto);
    // Se prueban todas las variantes del nombre; asi "un balde plastico" no se
    // rompe porque "balde" se leyo como envase.
    for (const variante of parse.variantesProducto.length ? parse.variantesProducto : [texto]) {
      const candidatos = buscar(indice, variante, { limite: 5 });
      let score = candidatos[0]?.score ?? 0;
      // Una hipotesis con cantidad reconocida vale mas que una sin ella.
      if (parse.cantidadTotal !== null) score += 0.05;
      if (!mejor || score > mejor.score) mejor = { texto, candidatos, score, parse };
    }
  }

  const p = mejor?.parse ?? parseEnunciado(hipotesis[0]);
  const envase = p.terminos.find((t) => t.factorEnvaseDesconocido);

  return {
    // Se reporta la hipotesis GANADORA, no la primera del reconocedor.
    transcripcion: mejor?.texto ?? hipotesis[0],
    hipotesis,
    candidatos: mejor?.candidatos ?? [],
    cantidad: p.cantidadTotal,
    unidad: p.unidad,
    unidadDicha: p.terminos[0]?.unidadDicha ?? null,
    avisos: p.avisos,
    envaseSinFactor: envase?.envase ?? null,
  };
}
