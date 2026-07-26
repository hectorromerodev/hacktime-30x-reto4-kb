import { ETIQUETA_UNIDAD, type Unidad } from '@conteo/core';

/**
 * Traduce el `exp10` (orden de magnitud del stock del sistema) a un rango
 * legible para el contador, sin revelar la cantidad esperada exacta.
 *
 * Todo el rango comparte el mismo exp10, así que solo se comunica la escala:
 * exp10 = 1 abarca de 10 a 99. Eso convierte un "fuera de escala" en un
 * "ah, ya entiendo".
 *
 * La unidad se pasa siempre. Antes iba fija en "unidades", así que el aviso de
 * un artículo medido en litros decía "entre 10 y 99 unidades": una confusión
 * de unidades dentro del mensaje que explica una anomalía — justo el error que
 * este producto existe para eliminar.
 *
 * ⚠ Sobre el conteo ciego: esto SÍ comunica la escala esperada, y con stock
 * bajo el rango es estrecho (exp10 = 0 → "entre 1 y 9"). Es un intercambio
 * deliberado entre explicabilidad y ceguera. Por eso el aviso va detrás de un
 * "¿Por qué?" y solo aparece DESPUÉS de que la persona ya capturó su número:
 * mostrarlo antes sería sugerirle qué escribir.
 */
export function rangoHabitual(exp10: number, unidad?: Unidad): string {
  const inferior = 10 ** exp10;
  const superior = 10 ** (exp10 + 1) - 1;
  // Sin unidad conocida se omite el sustantivo en vez de inventar uno.
  const nombre = unidad ? ` ${ETIQUETA_UNIDAD[unidad].plural}` : '';
  return (
    `entre ${inferior.toLocaleString('es-CO')} y ` +
    `${superior.toLocaleString('es-CO')}${nombre}`
  );
}
