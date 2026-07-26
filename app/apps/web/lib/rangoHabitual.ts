/**
 * Traduce el `exp10` (orden de magnitud del stock del sistema) a un rango
 * legible para el contador, sin revelar nunca la cantidad esperada exacta.
 *
 * Todo el rango comparte el mismo exp10, así que solo se comunica la escala:
 * exp10 = 1 abarca de 10 a 99. Eso convierte un "fuera de escala" en un
 * "ah, ya entiendo" sin romper el conteo ciego.
 */
export function rangoHabitual(exp10: number): string {
  const inferior = 10 ** exp10;
  const superior = 10 ** (exp10 + 1) - 1;
  return (
    `entre ${inferior.toLocaleString('es-CO')} y ` +
    `${superior.toLocaleString('es-CO')} unidades`
  );
}
