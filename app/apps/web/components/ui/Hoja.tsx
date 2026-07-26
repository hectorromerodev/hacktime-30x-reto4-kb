import { useEffect, useRef } from 'react';

/**
 * Hoja inferior (bottom sheet).
 *
 * En telefono se pega ABAJO y no al centro: es donde llega el pulgar. A partir
 * de 640 px se centra, porque en tablet una hoja anclada al borde inferior
 * queda lejos de la mirada y sobra espacio para centrarla.
 *
 * Existe porque el mismo bloque de clases estaba copiado en tres sitios: el
 * dialogo de anomalias de `contar` y los dos del cierre en `lider`. Tres copias
 * de un contenedor modal es donde empiezan a divergir el velo, el radio y el
 * anclaje sin que nadie lo note.
 *
 * El velo usa `--velo` (azul de marca translucido), no negro.
 *
 * AISLA lo que hay detras mientras esta abierta. Medido en la pantalla de
 * conteo: con el dialogo de anomalias abierto quedaban 36 controles vivos por
 * debajo — el teclado numerico entero, la lista y la cabecera. Ese es el
 * momento en que se decide si 900 eran 90; que un roce o un tabulador alcancen
 * lo de atras no es aceptable.
 */
export function Hoja({
  children,
  ancho = 'md',
  tono = 'neutro',
  titulo,
  onCerrar,
}: {
  children: React.ReactNode;
  /**
   * Si se pasa, tocar el velo cierra la hoja.
   *
   * Opcional a proposito: en el dialogo de anomalias NO debe existir. Ahi la
   * persona tiene que elegir entre volver a teclear, corregir o declarar un
   * motivo; poder descartarlo con un toque fuera seria una salida silenciosa de
   * la verificacion que el producto existe para forzar.
   */
  onCerrar?: () => void;
  /** `md` para dialogos de decision; `lg` cuando llevan tabla o lista. */
  ancho?: 'md' | 'lg';
  /**
   * `alerta` pinta una banda amarilla con el titulo. Se reserva para lo que
   * exige verificacion: como relleno el amarillo da 10.56:1 con texto oscuro,
   * y es imposible de confundir con el resto de la interfaz.
   */
  tono?: 'neutro' | 'alerta';
  titulo?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);

  /*
   * Aisla el resto de la pagina mientras la hoja esta montada.
   *
   * `inert` en los hermanos, y no un `tabIndex` a mano en cada control: apaga
   * el puntero, el teclado y la lectura de pantalla de golpe, y el navegador se
   * encarga de restaurarlo. Sin esto el velo solo tapa VISUALMENTE — debajo
   * seguian 36 controles pulsables y tabulables.
   *
   * Se restaura en la limpieza, tambien si el componente desaparece de golpe.
   */
  useEffect(() => {
    const propio = caja.current;
    if (!propio?.parentElement) return;
    const hermanos = [...propio.parentElement.children].filter(
      (h) => h !== propio && h instanceof HTMLElement,
    ) as HTMLElement[];
    const previos = hermanos.map((h) => h.hasAttribute('inert'));
    for (const h of hermanos) h.setAttribute('inert', '');
    return () => {
      hermanos.forEach((h, i) => {
        if (!previos[i]) h.removeAttribute('inert');
      });
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-[var(--velo)] p-4 sm:items-center sm:justify-center"
      onClick={onCerrar}
      ref={caja}
    >
      <div
        // El clic no atraviesa la hoja: sin esto, pulsar dentro tambien la
        // cerraria, y elegir un motivo se volveria imposible.
        onClick={(e) => e.stopPropagation()}
        /*
         * `text-texto` es OBLIGATORIO, no decoracion.
         *
         * Regla: todo componente que declara su propio FONDO tiene que declarar
         * tambien su color de TEXTO. Sin esto la hoja heredaba el color del
         * ancestro, y dentro de una pantalla azul (que pone `text-white`) el
         * titulo salia blanco sobre la hoja blanca: 1:1, literalmente invisible.
         * Funcionaba en `contar` solo porque esa pantalla es clara — el fallo
         * dependia de donde se montara el componente, que es justo lo que un
         * componente no debe permitir.
         */
        className={`w-full overflow-hidden rounded-2xl bg-superficie text-texto ${
          ancho === 'lg' ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        {tono === 'alerta' && titulo && (
          <div className="flex items-center gap-2 bg-alerta px-5 py-3">
            <span aria-hidden className="text-lg">
              ⚠
            </span>
            <p className="text-base font-bold text-texto">{titulo}</p>
          </div>
        )}
        {tono === 'neutro' && titulo && (
          <p className="px-5 pt-5 text-base font-semibold">{titulo}</p>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
