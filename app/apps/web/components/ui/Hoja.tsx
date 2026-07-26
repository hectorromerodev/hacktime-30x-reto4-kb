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
 */
export function Hoja({
  children,
  ancho = 'md',
  tono = 'neutro',
  titulo,
}: {
  children: React.ReactNode;
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
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[var(--velo)] p-4 sm:items-center sm:justify-center">
      <div
        className={`w-full overflow-hidden rounded-2xl bg-superficie ${
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
