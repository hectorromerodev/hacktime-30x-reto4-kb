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
import { ETIQUETA_UNIDAD, type Unidad } from '@conteo/core';
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
  /** Recibe el artículo y el código con el que se resolvió, para trazabilidad. */
  onArticulo: (a: ArticuloLocal, codigo: string) => void;
  onCerrar: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<string | null>(null);
  /**
   * Lo detectado, a la espera de que la persona lo valide con la vista.
   *
   * No se selecciona solo: una etiqueta de estante mal pegada, o el código de
   * la caja de al lado, harían contar el artículo equivocado sin que nadie se
   * entere. Un toque de más cuesta menos que un descuadre que aparece al
   * cierre del mes.
   */
  const [porConfirmar, setPorConfirmar] = useState<{
    articulo: ArticuloLocal;
    codigo: string;
  } | null>(null);

  /**
   * El catálogo se guarda en referencias para que el efecto de la cámara NO
   * dependa de ellas. `articulos` y `onArticulo` llegan como valores nuevos en
   * cada render del padre; si el efecto dependiera de ellos, la cámara se
   * apagaría y se volvería a pedir permiso en cada render.
   */
  const datos = useRef({ codigos, articulos });
  datos.current = { codigos, articulos };

  /** Se detiene la búsqueda mientras hay algo esperando validación. */
  const pausado = useRef(false);
  pausado.current = porConfirmar !== null;

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
        // Mientras algo espera validación no se sigue leyendo: si no, el
        // siguiente fotograma sobrescribiría lo que la persona está mirando.
        if (cancelado || pausado.current || !video.current || video.current.readyState < 2) {
          animacion = requestAnimationFrame(buscar);
          return;
        }
        try {
          const hallados = await detector.detect(video.current);
          for (const h of hallados) {
            const articulo = resolver(h.rawValue, datos.current.codigos, datos.current.articulos);
            if (articulo) {
              if (navigator.vibrate) navigator.vibrate(60);
              setPorConfirmar({ articulo, codigo: h.rawValue });
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
    // Sin dependencias: la cámara se abre una vez y se cierra al desmontar.
    // Los datos que cambian se leen por referencia (ver `datos` arriba).
  }, []);

  return (
    <div className="alto-pantalla fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 text-sm text-tenue">Apunta al código o al QR del estante</p>
        <button
          onClick={onCerrar}
          className="toque shrink-0 rounded-xl border border-borde px-5 text-sm font-medium"
        >
          Cancelar
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />

        {/* Salida grande sobre el video: en la tablet, con el aparato en una
            mano, el boton de la cabecera queda lejos del pulgar. */}
        <button
          onClick={onCerrar}
          aria-label="Salir del escáner"
          className="toque absolute right-4 top-4 flex items-center justify-center rounded-full bg-black/70 px-5 text-2xl text-white backdrop-blur"
        >
          ✕
        </button>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`h-56 w-56 rounded-2xl border-4 ${
              porConfirmar ? 'border-acento' : 'border-acento/80'
            }`}
          />
        </div>
      </div>

      {/* ── Validación visual ────────────────────────────────────────────
          Se muestra el código leído tal cual y el artículo al que resolvió,
          con su número de catálogo, para poder cotejarlo contra lo que se
          tiene en la mano antes de contarlo. */}
      {porConfirmar && (
        <div className="border-t border-acento/50 bg-superficie px-5 py-4">
          <p className="mb-1 font-mono text-xs text-tenue">
            código leído: <span className="text-white">{porConfirmar.codigo}</span>
          </p>
          <p className="text-xl font-semibold">{porConfirmar.articulo.nombre.trim()}</p>
          <p className="mb-4 text-sm text-tenue">
            {porConfirmar.articulo.nrArticulo
              ? `Nr. ${porConfirmar.articulo.nrArticulo} · `
              : 'sin Nr. de artículo · '}
            {ETIQUETA_UNIDAD[porConfirmar.articulo.unidad as Unidad].plural}
            {porConfirmar.articulo.familia ? ` · ${porConfirmar.articulo.familia.toLowerCase()}` : ''}
          </p>

          <div className="grid gap-2">
            <button
              onClick={() => onArticulo(porConfirmar.articulo, porConfirmar.codigo)}
              className="toque rounded-xl bg-acento text-base font-semibold text-black"
            >
              Sí, contar este
            </button>
            <button
              onClick={() => {
                setPorConfirmar(null);
                setUltimo(null);
              }}
              className="toque rounded-xl border border-borde text-base"
            >
              No es · escanear otro
            </button>
            <button onClick={onCerrar} className="py-2 text-sm text-tenue">
              Salir del escáner
            </button>
          </div>
        </div>
      )}

      {error && <p className="px-5 py-4 text-sm text-alerta">{error}</p>}
      {!error && !porConfirmar && ultimo && (
        <p className="px-5 py-3 text-xs text-tenue">
          Código leído sin artículo asociado:{' '}
          <span className="font-mono text-white">{ultimo}</span>
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
