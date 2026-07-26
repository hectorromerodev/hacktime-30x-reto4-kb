/**
 * Boton.
 *
 * Concentra dos reglas que estaban repartidas por seis archivos y que es facil
 * romper a mano:
 *
 * 1. EL COLOR DEL TEXTO DEPENDE DEL RELLENO. Sobre el azul de marca va blanco
 *    (8.78:1); sobre el amarillo va OSCURO (10.56:1), porque blanco sobre
 *    #FFD000 da 1.47:1 — ilegible. No es cosmetico, es la diferencia entre
 *    leerse y no leerse.
 * 2. UN BOTON DELINEADO USA `borde-fuerte`, no `borde`. Cuando el contorno es
 *    el unico limite del control necesita 3:1 (WCAG 1.4.11); `--borde` esta en
 *    1.36:1 y sirve para agrupar, no para delimitar lo pulsable.
 */
export function Boton({
  children,
  onClick,
  variante = 'primario',
  ancho,
  desactivado,
  tipo = 'button',
  titulo,
  etiqueta,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  /**
   * `primario` accion principal (azul) · `atencion` merma y bajas (amarillo) ·
   * `peligro` destructivo · `contorno` accion secundaria · `plano` terciaria.
   */
  variante?: 'primario' | 'atencion' | 'peligro' | 'contorno' | 'plano';
  ancho?: boolean;
  desactivado?: boolean;
  tipo?: 'button' | 'submit';
  titulo?: string;
  etiqueta?: string;
}) {
  const estilos: Record<string, string> = {
    primario: 'bg-acento font-semibold text-white active:bg-[var(--acento-oscuro)]',
    atencion: 'bg-alerta font-semibold text-texto active:brightness-95',
    // Blanco sobre #C0392B da 5.44:1 (AA). Se reserva a lo que destruye algo:
    // aqui, terminar la sesion y obligar a volver a teclear el PIN.
    peligro: 'bg-peligro font-semibold text-white active:brightness-90',
    /*
     * `contorno` y `plano` llevan color de texto EXPLICITO.
     *
     * Antes solo declaraban borde y grosor, asi que heredaban el color del
     * contenedor. Dentro de una hoja blanca montada en una pantalla azul eso
     * salia blanco sobre blanco: el boton existia y no se veia. Un boton no
     * puede depender de donde lo pongan para ser legible.
     */
    contorno:
      'border border-borde-fuerte font-medium text-texto active:border-acento active:bg-acento/10',
    plano: 'text-tenue active:bg-superficie-alta',
  };

  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={desactivado}
      title={titulo}
      aria-label={etiqueta}
      className={`toque rounded-xl px-4 text-base transition-colors disabled:opacity-40 ${
        estilos[variante]
      } ${ancho ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}
