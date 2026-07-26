/**
 * La maquina de estados del dictado seguido, aparte de la pantalla.
 *
 * Vivia repartida en tres sitios —el `onend` del reconocedor, el efecto de
 * reanudacion y el manejador del boton— cada uno con su propia copia de las
 * condiciones. Cuando la copia del `onend` y la del efecto dejaron de
 * coincidir, el microfono se quedaba abierto detras de las tarjetas de
 * candidatos: seguia escuchando mientras alguien elegia, y la frase siguiente
 * reemplazaba las opciones que estaba leyendo.
 *
 * Aqui esta la unica copia, y es una funcion pura para poder probarla sin
 * microfono ni navegador.
 */

/** Fallos seguidos tras los cuales la cadena se apaga sola. */
export const LIMITE_FALLOS = 3;

export interface EstadoCadena {
  /** La preferencia del interruptor. */
  continuo: boolean;
  /**
   * ¿Hay una cadena en curso? Se enciende al tocar el microfono, no al activar
   * el interruptor: encenderlo no debe abrir el microfono de nadie.
   */
  cadenaActiva: boolean;
  /**
   * ¿La pantalla espera un toque? Articulo activo, tarjetas de candidatos,
   * dialogo de anomalia o camara abierta.
   */
  requiereAtencion: boolean;
  /** ¿El microfono esta abierto ahora mismo? */
  escuchando: boolean;
  /** El contador lo detuvo a proposito. */
  detenidoAMano: boolean;
  fallosSeguidos: number;
}

export type AccionDictado = 'ABRIR' | 'CERRAR' | 'NADA';

/**
 * Que hacer con el microfono dado el estado de la pantalla.
 *
 * `CERRAR` no distingue modo seguido de dictado normal a proposito: tocar un
 * articulo de la lista con el microfono abierto lo dejaba corriendo detras de
 * la pantalla de cantidad, donde ni siquiera se dibuja el boton para apagarlo.
 */
export function siguienteAccion(e: EstadoCadena): AccionDictado {
  if (e.requiereAtencion) return e.escuchando ? 'CERRAR' : 'NADA';
  if (!e.continuo || !e.cadenaActiva) return 'NADA';
  if (e.detenidoAMano || e.fallosSeguidos >= LIMITE_FALLOS) return 'NADA';
  return e.escuchando ? 'NADA' : 'ABRIR';
}
