'use client';

/**
 * Cierre del conteo: lo que ve el lider de costos.
 *
 * Es la unica pantalla donde SI aparece la cantidad del sistema, porque el
 * conteo ya termino. Durante la captura seria una fuga; aqui es exactamente lo
 * que la duena del negocio pidio: "algun reporte que me permita sacar cuanto
 * subi y cuanto me cargo al sistema".
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, urlBase } from '@/lib/api';

interface Diferencia {
  nrArticulo: string | null;
  articulo: string;
  unidad: string;
  sistema: number;
  contado: number | null;
  diferencia: number;
  contadores: string[];
  anomalias: string[];
  enConflicto: boolean;
}

interface Conflicto {
  nrArticulo: string | null;
  articulo: string;
  unidad: string;
  sistema: number;
  porContador: { nombre: string; cantidad: number }[];
}

interface Reporte {
  bodega: string;
  periodo: string;
  estado: string;
  conflictos: Conflicto[];
  resumen: {
    articulosCatalogo: number;
    contados: number;
    sinContar: number;
    conDiferencia: number;
    exactitud: number;
    enConflicto: number;
  };
  diferencias: Diferencia[];
}

export default function Lider() {
  const { conteoId } = useParams<{ conteoId: string }>();
  const router = useRouter();
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Reporte>(`/conteos/${conteoId}/reporte`)
      .then(setReporte)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte.'));
  }, [conteoId]);

  if (error) return <Centro><p className="text-peligro">{error}</p></Centro>;
  if (!reporte) return <Centro><p className="text-tenue">Cargando reporte…</p></Centro>;

  const { resumen } = reporte;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-6">
      <button onClick={() => router.push(`/contar/${conteoId}`)} className="mb-4 text-sm text-tenue">
        ← Volver al conteo
      </button>

      <h1 className="text-2xl font-semibold">{reporte.bodega}</h1>
      <p className="mb-6 text-sm text-tenue">
        Periodo {reporte.periodo} · conteo {reporte.estado.toLowerCase()}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato valor={resumen.contados} etiqueta="resueltos" />
        <Dato valor={resumen.sinContar} etiqueta="sin contar" alerta={resumen.sinContar > 0} />
        <Dato
          valor={resumen.enConflicto}
          etiqueta="por resolver"
          alerta={resumen.enConflicto > 0}
        />
        <Dato valor={`${resumen.exactitud}%`} etiqueta="exactitud" />
      </div>

      {resumen.enConflicto > 0 && (
        <div className="tarjeta mb-6 border-alerta/60">
          <p className="text-sm font-medium text-alerta">
            {resumen.enConflicto} artículo(s) contados por más de una persona
          </p>
          <p className="mt-1 mb-3 text-sm text-tenue">
            <strong className="text-white">Quedan sin cantidad</strong> hasta que decidas. No se
            suman solos: dos personas contando lo mismo puede ser un recuento (reemplaza) o dos
            ubicaciones del mismo producto (suma), y adivinar cuál es sería inventar el dato.
          </p>
          <ul className="grid gap-2">
            {(reporte.conflictos ?? []).map((c) => (
              <li key={c.articulo} className="rounded-xl bg-superficie-alta p-3 text-sm">
                <p className="font-medium">{c.articulo}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-tenue">
                  {c.porContador.map((p) => (
                    <span key={p.nombre}>
                      {p.nombre}:{' '}
                      <strong className="tabular-nums text-white">
                        {p.cantidad.toLocaleString('es-CO')}
                      </strong>
                    </span>
                  ))}
                  <span className="text-tenue">
                    · sistema: {c.sistema.toLocaleString('es-CO')}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <a
          href={`${urlBase}/conteos/${conteoId}/export.xlsx`}
          className="toque flex items-center rounded-xl bg-acento px-5 font-semibold text-black"
        >
          Descargar Excel (3 hojas)
        </a>
        <a
          href={`${urlBase}/conteos/${conteoId}/export.csv`}
          className="toque flex items-center rounded-xl border border-borde px-5"
        >
          Descargar CSV
        </a>
        <a
          href={`/etiquetas/${conteoId}`}
          className="toque flex items-center rounded-xl border border-borde px-5"
        >
          Imprimir etiquetas QR
        </a>
      </div>

      <h2 className="mb-3 text-lg">Diferencias contra el sistema</h2>
      {reporte.diferencias.length === 0 ? (
        <p className="text-tenue">Todavía no hay diferencias registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-tenue">
                <th className="py-2 pr-3">Artículo</th>
                <th className="py-2 pr-3 text-right">Sistema</th>
                <th className="py-2 pr-3 text-right">Contado</th>
                <th className="py-2 pr-3 text-right">Diferencia</th>
                <th className="py-2">Contador</th>
              </tr>
            </thead>
            <tbody>
              {reporte.diferencias.map((d) => (
                <tr key={d.articulo + d.nrArticulo} className="border-b border-borde/50">
                  <td className="py-2 pr-3">
                    {d.articulo}
                    {d.enConflicto && <span className="ml-2 text-xs text-alerta">conflicto</span>}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-tenue">
                    {d.sistema.toLocaleString('es-CO')}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {d.contado?.toLocaleString('es-CO') ?? '—'}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right font-medium tabular-nums ${
                      d.diferencia < 0 ? 'text-peligro' : 'text-acento'
                    }`}
                  >
                    {d.diferencia > 0 ? '+' : ''}
                    {d.diferencia.toLocaleString('es-CO')}
                  </td>
                  <td className="py-2 text-tenue">{d.contadores.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Dato({
  valor,
  etiqueta,
  alerta,
}: {
  valor: number | string;
  etiqueta: string;
  alerta?: boolean;
}) {
  return (
    <div className="tarjeta">
      <p className={`text-3xl font-bold tabular-nums ${alerta ? 'text-alerta' : ''}`}>{valor}</p>
      <p className="text-xs text-tenue">{etiqueta}</p>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <main className="flex h-screen items-center justify-center px-6">{children}</main>;
}
