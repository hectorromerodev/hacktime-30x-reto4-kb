'use client';

/**
 * Escaner de codigos.
 *
 * Colsubsidio fue claro: "no todos los productos tienen un ID unico" dentro de
 * la aplicacion. Por eso el escaneo NO es el camino principal — el matcher por
 * nombre lo es — pero si resuelve dos cosas reales:
 *
 *  1. Los productos que SI traen codigo de barras se seleccionan al instante.
 *  2. Las ETIQUETAS QR DE ESTANTE (que esta misma app genera e imprime) cubren
 *     el 100% del catalogo. Es la respuesta implementable a la objecion del
 *     cliente: si el producto no tiene identificador, se etiqueta el estante,
 *     no el producto.
 *
 * Usa la API nativa `BarcodeDetector`, disponible en Chrome/Android, que es el
 * entorno de las tablets corporativas. Donde no existe, se dice claramente en
 * vez de fallar en silencio.
 */

import { useEffect, useRef, useState } from 'react';
import type { ArticuloLocal } from '@/lib/db';

/** Prefijo de las etiquetas QR que genera la app: `PSL:<articuloId>`. */
const PREFIJO_QR = 'PSL:';

interface DetectorCodigos {
  detect(fuente: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

export function EscanerCodigo({
  codigos,
  articulos,
  onArticulo,
  onCerrar,
}: {
  codigos: Map<string, string>;
  articulos: ArticuloLocal[];
  onArticulo: (a: ArticuloLocal) => void;
  onCerrar: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<string | null>(null);

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let animacion = 0;
    let cancelado = false;

    (async () => {
      const Ctor = (window as unknown as Record<string, unknown>).BarcodeDetector as
        | (new (o: { formats: string[] }) => DetectorCodigos)
        | undefined;

      if (!Ctor) {
        setError(
          'Este navegador no trae lector de códigos. Usa la voz o la búsqueda por nombre.',
        );
        return;
      }

      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch {
        setError('No se pudo abrir la cámara. Revisa los permisos.');
        return;
      }

      if (cancelado || !video.current) return;
      video.current.srcObject = flujo;
      await video.current.play().catch(() => {});

      const detector = new Ctor({
        formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
      });

      const buscar = async () => {
        if (cancelado || !video.current || video.current.readyState < 2) {
          animacion = requestAnimationFrame(buscar);
          return;
        }
        try {
          const hallados = await detector.detect(video.current);
          for (const h of hallados) {
            const articulo = resolver(h.rawValue, codigos, articulos);
            if (articulo) {
              if (navigator.vibrate) navigator.vibrate(60);
              onArticulo(articulo);
              return;
            }
            setUltimo(h.rawValue);
          }
        } catch {
          /* fotograma ilegible, se sigue intentando */
        }
        animacion = requestAnimationFrame(buscar);
      };
      animacion = requestAnimationFrame(buscar);
    })();

    return () => {
      cancelado = true;
      cancelAnimationFrame(animacion);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, [codigos, articulos, onArticulo]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm text-tenue">Apunta al código o al QR del estante</p>
        <button onClick={onCerrar} className="toque px-4 text-sm">
          Cerrar
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-56 w-56 rounded-2xl border-4 border-acento/80" />
        </div>
      </div>

      {error && <p className="px-5 py-4 text-sm text-alerta">{error}</p>}
      {!error && ultimo && (
        <p className="px-5 py-3 text-xs text-tenue">
          Código leído sin artículo asociado: <span className="text-white">{ultimo}</span>
        </p>
      )}
    </div>
  );
}

/** Resuelve un código a un artículo: QR de estante, código conocido o Nr.Artículo. */
function resolver(
  bruto: string,
  codigos: Map<string, string>,
  articulos: ArticuloLocal[],
): ArticuloLocal | null {
  const valor = bruto.trim();

  if (valor.startsWith(PREFIJO_QR)) {
    const id = valor.slice(PREFIJO_QR.length);
    return articulos.find((a) => a.id === id) ?? null;
  }

  const porCodigo = codigos.get(valor);
  if (porCodigo) return articulos.find((a) => a.id === porCodigo) ?? null;

  // Ultimo recurso: el codigo coincide con el Nr.Articulo del catalogo.
  return articulos.find((a) => a.nrArticulo && a.nrArticulo === valor) ?? null;
}
