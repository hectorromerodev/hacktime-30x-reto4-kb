/**
 * Ficha seleccionable.
 *
 * El mismo patron aparecia cuatro veces con clases copiadas: filtros de
 * familia, motivos de merma, motivos de confirmacion y pestañas del cierre.
 * Cada copia habia derivado por su lado en alto, tamaño de texto y grosor.
 *
 * Alto minimo 44 px (`toque-menor`) y no los 56 de `.toque`: son controles
 * secundarios y hay hasta nueve seguidos, asi que 56 se comeria una pantalla
 * de telefono entera. Por debajo de 44 el dedo falla de verdad — estaban en 34.
 */
export function Chip({
  children,
  onClick,
  activo,
  tono = 'acento',
}: {
  children: React.ReactNode;
  onClick: () => void;
  activo?: boolean;
  /** `atencion` para lo que marca una baja o una anomalia. */
  tono?: 'acento' | 'atencion';
}) {
  const activos = {
    acento: 'border-acento bg-acento/15 font-medium text-acento',
    atencion: 'border-alerta-texto bg-alerta/25 font-medium text-alerta-texto',
  }[tono];

  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`toque-menor shrink-0 rounded-full border px-4 text-sm transition-colors ${
        activo ? activos : 'border-borde-fuerte text-tenue'
      }`}
    >
      {children}
    </button>
  );
}
