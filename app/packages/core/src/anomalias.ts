/**
 * Reglas de anomalía. Se evalúan ANTES de guardar, como pide el brief:
 * "Si el patrón de esa bodega sugiere que normalmente hay 9 cajas y hoy alguien
 *  reporta 90, pregunta antes de dejarlo pasar."
 *
 * ── La tensión central del reto y cómo se resuelve ──
 *
 * Detectar el salto 9→90 exige conocer lo que el sistema espera. Pero el conteo
 * es CIEGO: "se hace de manera ciega para asegurar que la persona cuente
 * realmente lo que hay, no lo que el sistema está esperando."  Y además tiene
 * que funcionar sin red, o sea con el dato ya en el dispositivo.
 *
 * Solución: el dispositivo nunca recibe `sd`. Recibe `exp10`, el ORDEN DE
 * MAGNITUD  —  floor(log10(sd)).  Con eso alcanza para detectar que 90 está un
 * orden por encima de lo habitual, y no alcanza para copiar la respuesta: quien
 * abriera las herramientas del navegador solo aprendería "esto suele estar en
 * las decenas". La integridad de la auditoría queda intacta y la detección
 * funciona en modo avión.
 */

import type { CodigoAnomalia, SeveridadAnomalia, Unidad } from './tipos.ts';
import { ETIQUETA_UNIDAD, etiquetaUnidad } from './tipos.ts';

export interface Anomalia {
  codigo: CodigoAnomalia;
  severidad: SeveridadAnomalia;
  titulo: string;
  mensaje: string;
  /** Opciones grandes para resolver de un toque. La primera es la primaria. */
  opciones?: OpcionAnomalia[];
}

export interface OpcionAnomalia {
  etiqueta: string;
  accion: 'RETECLEAR' | 'ACEPTAR' | 'CORREGIR_A' | 'CANCELAR' | 'RECUENTO' | 'SUMAR';
  /** Valor propuesto cuando la acción es CORREGIR_A. */
  valor?: number;
}

/** Motivos que se exigen al aceptar una cantidad marcada como inusual. */
export const MOTIVOS_CONFIRMACION = [
  'Llegó pedido nuevo',
  'Ya verifiqué contando otra vez',
  'Producto reubicado desde otra bodega',
  'Otro',
] as const;

export interface ContextoAnomalia {
  cantidad: number;
  unidadCapturada: Unidad;
  unidadCatalogo: Unidad;
  nombreArticulo: string;
  /** Orden de magnitud del stock del sistema. null = sin dato o stock <= 0. */
  exp10: number | null;
  /** Puntaje del matcher, si el artículo se resolvió por voz o búsqueda. */
  scoreMatch?: number | null;
  scoreSegundo?: number | null;
  /** Nombre de quien ya contó este artículo en la sesión, si aplica. */
  yaContadoPor?: string | null;
  /** Minutos desde ese conteo previo. */
  minutosDesdeConteoPrevio?: number | null;
  /** Se dijo un envase sin factor de conversión conocido. */
  envaseSinFactor?: string | null;
}

const UMBRAL_MATCH_DUDOSO = 0.75;
const UMBRAL_MARGEN_DUDOSO = 0.08;
const MAGNITUD_ABSURDA = 100_000;

/** Orden de magnitud de una cantidad contada. */
export function ordenDeMagnitud(valor: number): number | null {
  const abs = Math.abs(valor);
  if (abs < 1) return 0;
  return Math.floor(Math.log10(abs));
}

/** Calcula el `exp10` que se envía al dispositivo. Se usa en el servidor. */
export function calcularExp10(sd: number): number | null {
  if (!Number.isFinite(sd) || sd <= 0) return null;
  return Math.floor(Math.log10(sd));
}

export function evaluarAnomalias(ctx: ContextoAnomalia): Anomalia[] {
  const anomalias: Anomalia[] = [];
  const { cantidad, unidadCatalogo, nombreArticulo } = ctx;
  const etiqueta = etiquetaUnidad(unidadCatalogo, cantidad);

  // R2 — Negativo. Bloqueo duro: el dataset trae 79 saldos negativos heredados
  // del sistema y no vamos a fabricar más desde el conteo físico.
  if (cantidad < 0) {
    anomalias.push({
      codigo: 'R2_NEGATIVO',
      severidad: 'BLOQUEO',
      titulo: 'Cantidad negativa',
      mensaje: 'Un conteo físico no puede ser negativo. Vuelve a teclear la cantidad.',
      opciones: [{ etiqueta: 'Volver a teclear', accion: 'RETECLEAR' }],
    });
    return anomalias; // Nada más tiene sentido evaluar.
  }

  // R3 — Unidad discordante. Es el "cinco kilos ≠ cinco gramos" del brief,
  // resuelto por construcción y sin IA.
  if (ctx.unidadCapturada !== unidadCatalogo) {
    anomalias.push({
      codigo: 'R3_UNIDAD_DISCORDANTE',
      severidad: 'BLOQUEO',
      titulo: 'Unidad que no corresponde',
      mensaje:
        `${nombreArticulo} se cuenta en ${ETIQUETA_UNIDAD[unidadCatalogo].plural}, ` +
        `pero la captura vino en ${ETIQUETA_UNIDAD[ctx.unidadCapturada].plural}.`,
      opciones: [
        { etiqueta: 'Volver a teclear', accion: 'RETECLEAR' },
        {
          etiqueta: `Guardar como ${cantidad} ${ETIQUETA_UNIDAD[unidadCatalogo].corta}`,
          accion: 'ACEPTAR',
        },
      ],
    });
  }

  // R1 — Decimal sobre un artículo que se cuenta por unidades enteras.
  // El dataset tiene 16 casos así: los "decimales raros" que mencionó la
  // dueña del negocio en el live.
  if (unidadCatalogo === 'Unidad' && !Number.isInteger(cantidad)) {
    anomalias.push({
      codigo: 'R1_DECIMAL_EN_UNIDAD',
      severidad: 'CONFIRMAR',
      titulo: 'Fracción en un artículo por unidades',
      mensaje:
        `${nombreArticulo} se cuenta en unidades enteras y capturaste ${cantidad}. ` +
        '¿Es un empaque abierto?',
      opciones: [
        { etiqueta: 'Volver a teclear', accion: 'RETECLEAR' },
        { etiqueta: `Corregir a ${Math.round(cantidad)}`, accion: 'CORREGIR_A', valor: Math.round(cantidad) },
        { etiqueta: 'Es correcto', accion: 'ACEPTAR' },
      ],
    });
  }

  // R5 — Cero explícito. Válido, pero se confirma: declarar agotado un artículo
  // es una afirmación, no un descuido.
  if (cantidad === 0) {
    anomalias.push({
      codigo: 'R5_CERO_EXPLICITO',
      severidad: 'CONFIRMAR',
      titulo: 'Existencia en cero',
      mensaje: `¿Confirmas que no hay existencias de ${nombreArticulo}?`,
      opciones: [
        { etiqueta: 'Sí, está agotado', accion: 'ACEPTAR' },
        { etiqueta: 'Volver a teclear', accion: 'RETECLEAR' },
      ],
    });
  }

  // R6 — Magnitud absurda en términos absolutos.
  if (cantidad > MAGNITUD_ABSURDA) {
    anomalias.push({
      codigo: 'R6_MAGNITUD_ABSURDA',
      severidad: 'CONFIRMAR',
      titulo: 'Cantidad fuera de rango',
      mensaje: `${cantidad.toLocaleString('es-CO')} ${etiqueta} es una cantidad muy alta. Verifica antes de guardar.`,
      opciones: [
        { etiqueta: 'Volver a teclear', accion: 'RETECLEAR' },
        { etiqueta: 'Es correcto', accion: 'ACEPTAR' },
      ],
    });
  }

  // R8 — Salto de orden de magnitud. LA regla del reto: el caso 9 → 90.
  // Usa exp10, nunca el valor esperado, así que se puede evaluar offline
  // sin romper el conteo ciego.
  if (ctx.exp10 !== null && cantidad > 0) {
    const ordenCapturado = ordenDeMagnitud(cantidad);
    if (ordenCapturado !== null && Math.abs(ordenCapturado - ctx.exp10) >= 1) {
      const dividido = redondear(cantidad / 10);
      const multiplicado = redondear(cantidad * 10);
      const vecino = ordenCapturado > ctx.exp10 ? dividido : multiplicado;

      const opciones: OpcionAnomalia[] = [
        { etiqueta: 'Volver a teclear', accion: 'RETECLEAR' },
      ];
      // Solo se ofrece el vecino si efectivamente cae en el orden esperado:
      // así la sugerencia nunca revela el valor del sistema, solo la escala.
      if (ordenDeMagnitud(vecino) === ctx.exp10) {
        opciones.push({
          etiqueta: `¿Eran ${formatear(vecino)}?`,
          accion: 'CORREGIR_A',
          valor: vecino,
        });
      }
      opciones.push({ etiqueta: 'Es correcto', accion: 'ACEPTAR' });

      anomalias.push({
        codigo: 'R8_SALTO_DE_MAGNITUD',
        severidad: 'CONFIRMAR',
        titulo: 'Verificación de cantidad',
        mensaje:
          `${formatear(cantidad)} ${etiqueta} está fuera de la escala habitual de ` +
          `${nombreArticulo} en esta bodega. Cuenta otra vez para confirmar.`,
        opciones,
      });
    }
  }

  // R4 — El matcher no está seguro de cuál artículo es.
  if (ctx.scoreMatch != null) {
    const margen = ctx.scoreMatch - (ctx.scoreSegundo ?? 0);
    if (ctx.scoreMatch < UMBRAL_MATCH_DUDOSO || margen < UMBRAL_MARGEN_DUDOSO) {
      anomalias.push({
        codigo: 'R4_MATCH_DEBIL',
        severidad: 'CONFIRMAR',
        titulo: 'Confirma el artículo',
        mensaje: `Hay varios artículos parecidos a lo que dictaste. Elige cuál es.`,
        opciones: [{ etiqueta: 'Elegir artículo', accion: 'RETECLEAR' }],
      });
    }
  }

  // R7 — Ya contado en esta sesión. Nunca se suma en silencio: el proceso real
  // tiene un contador y un auditor que recuenta, y confundir recuento con suma
  // duplicaría inventario.
  if (ctx.yaContadoPor) {
    const cuando =
      ctx.minutosDesdeConteoPrevio != null
        ? ` hace ${ctx.minutosDesdeConteoPrevio} min`
        : '';
    anomalias.push({
      codigo: 'R7_DUPLICADO_EN_SESION',
      severidad: 'CONFIRMAR',
      titulo: 'Artículo ya contado',
      // A propósito no se muestra la cantidad del otro contador: el conteo
      // también es ciego ENTRE contadores, que es el control de auditoría.
      mensaje: `${ctx.yaContadoPor} ya contó ${nombreArticulo}${cuando}.`,
      opciones: [
        { etiqueta: 'Es un recuento (reemplaza)', accion: 'RECUENTO' },
        { etiqueta: 'Otra ubicación (suma)', accion: 'SUMAR' },
        { etiqueta: 'Cancelar', accion: 'CANCELAR' },
      ],
    });
  }

  // R9 — Envase sin factor de conversión. No se inventa la equivalencia.
  if (ctx.envaseSinFactor) {
    anomalias.push({
      codigo: 'R9_ENVASE_SIN_FACTOR',
      severidad: 'CONFIRMAR',
      titulo: 'Falta el factor del empaque',
      mensaje:
        `El catálogo no sabe cuántas ${ETIQUETA_UNIDAD[unidadCatalogo].plural} trae ` +
        `una ${ctx.envaseSinFactor} de ${nombreArticulo}. Indícalo una vez y queda guardado.`,
      opciones: [{ etiqueta: 'Indicar equivalencia', accion: 'RETECLEAR' }],
    });
  }

  return anomalias;
}

/** ¿Hay algo que impida guardar? */
export function bloquea(anomalias: Anomalia[]): boolean {
  return anomalias.some((a) => a.severidad === 'BLOQUEO');
}

/** ¿Se puede guardar directo, sin diálogo? */
export function guardaDirecto(anomalias: Anomalia[]): boolean {
  return anomalias.length === 0;
}

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function formatear(n: number): string {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 3 });
}
