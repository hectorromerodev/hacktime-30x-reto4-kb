'use client';

/**
 * Hoja imprimible de etiquetas QR de estante.
 *
 * Esta pagina es la respuesta a la objecion mas dura del cliente: "no todos los
 * productos tienen un ID unico" dentro de la aplicacion. Si el producto no se
 * puede identificar, se identifica el ESTANTE. Se imprime esta hoja una vez por
 * bodega, se pegan las etiquetas, y a partir de ahi cualquier articulo del
 * catalogo se selecciona con un escaneo — incluidos los que Oracle no tiene
 * codificados.
 *
 * Se imprime en el orden fisico del almacen (el mismo del formato en papel),
 * asi que pegarlas es recorrer la bodega de principio a fin.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { ETIQUETA_UNIDAD, type Unidad } from '@conteo/core';

interface Articulo {
  id: string;
  nrArticulo: string | null;
  nombre: string;
  unidad: string;
  familia: string;
  orden: number;
}

/**
 * Qué se codifica dentro del QR.
 *
 * Se usa el **número de artículo** siempre que exista: así, escaneada con
 * cualquier lector del teléfono, la etiqueta muestra `7290` — un dato que se
 * puede cotejar contra el sistema. Antes se codificaba el identificador
 * interno y salía una cadena ilegible.
 *
 * Los 252 artículos que el sistema origen dejó sin número caen al
 * identificador interno, que es lo único que los distingue. Ahí el QR sí sale
 * opaco, pero es eso o no poder etiquetarlos.
 */
function contenidoQR(a: Articulo): string {
  return a.nrArticulo ? a.nrArticulo : `PSL:${a.id}`;
}

export default function Etiquetas() {
  const { conteoId } = useParams<{ conteoId: string }>();
  const [bodega, setBodega] = useState('');
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [qrs, setQrs] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cat = await api<{ bodega: string; articulos: Articulo[] }>(
          `/conteos/${conteoId}/catalogo`,
        );
        setBodega(cat.bodega);
        setArticulos(cat.articulos);

        const mapa = new Map<string, string>();
        for (const a of cat.articulos) {
          mapa.set(
            a.id,
            await QRCode.toDataURL(contenidoQR(a), {
              margin: 0,
              width: 160,
              errorCorrectionLevel: 'M',
            }),
          );
        }
        setQrs(mapa);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.');
      }
    })();
  }, [conteoId]);

  if (error) return <p className="p-8 text-peligro">{error}</p>;
  if (articulos.length === 0) return <p className="p-8 text-tenue">Generando etiquetas…</p>;

  return (
    <main className="mx-auto max-w-5xl bg-white p-6 text-black print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold">Etiquetas de estante · {bodega}</h1>
          <p className="text-sm text-neutral-600">
            {articulos.length} etiquetas, en el orden físico del almacén.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            El QR lleva el <strong>número de artículo</strong> cuando existe (
            {articulos.filter((a) => a.nrArticulo).length} de {articulos.length}); el resto
            lleva su identificador interno, que es lo único que los distingue. Debajo de cada
            QR se imprime lo mismo que codifica, para poder verificarlo sin escanear.
          </p>
        </div>
        <button
          // `window.print()` es sincrono y bloquea el hilo mientras el
          // navegador arma la vista previa: pulsarlo directo congelaba la
          // interfaz unos milisegundos (aviso de INP). Cediendo un fotograma,
          // el boton alcanza a responder antes de que el hilo se ocupe.
          onClick={() => requestAnimationFrame(() => window.print())}
          className="rounded-xl bg-black px-5 py-3 font-medium text-white"
        >
          Imprimir
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 print:grid-cols-3">
        {articulos.map((a) => (
          <div
            key={a.id}
            className="flex break-inside-avoid items-center gap-3 rounded-lg border border-neutral-300 p-2"
          >
            {qrs.get(a.id) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrs.get(a.id)} alt="" width={76} height={76} className="shrink-0" />
            )}
            <div className="min-w-0 text-[11px] leading-tight">
              {/* Se imprime EXACTAMENTE lo que va dentro del QR, para poder
                  cotejar la etiqueta sin escanearla. Con número, va grande
                  porque es lo que se compara contra el sistema. Sin número
                  —21 de 56 en esta bodega— va el identificador, que es lo
                  único que distingue a ese artículo: ilegible de leer, pero
                  imprimir "sin número" dejaba la etiqueta sin forma de
                  verificarse. */}
              {a.nrArticulo ? (
                <p className="font-mono text-[15px] font-bold leading-none">{a.nrArticulo}</p>
              ) : (
                <p className="break-all font-mono text-[8px] leading-tight text-neutral-500">
                  {contenidoQR(a)}
                </p>
              )}
              <p className="mt-0.5 font-semibold">{a.nombre.trim()}</p>
              <p className="text-neutral-600">{ETIQUETA_UNIDAD[a.unidad as Unidad].plural}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
