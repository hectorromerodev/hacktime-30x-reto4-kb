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
          // Mismo prefijo que reconoce el escaner: PSL:<articuloId>
          mapa.set(
            a.id,
            await QRCode.toDataURL(`PSL:${a.id}`, {
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
              <p className="font-semibold">{a.nombre.trim()}</p>
              <p className="text-neutral-600">
                {ETIQUETA_UNIDAD[a.unidad as Unidad].plural}
                {a.nrArticulo ? ` · ${a.nrArticulo}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
