'use client';

/**
 * Cierre del conteo: lo que ve el líder de costos.
 *
 * Es la única pantalla donde SÍ aparece la cantidad del sistema, porque el
 * conteo ya terminó. Durante la captura sería una fuga; aquí es exactamente lo
 * que la dueña del proceso pidió: *"algún reporte que me permita sacar cuánto
 * subí y cuánto me cargó al sistema"*.
 *
 * Muestra en pantalla lo mismo que lleva el Excel —conteo, diferencias, merma
 * con sus fotos, trazabilidad— para poder revisarlo sin descargar nada, y
 * permite cerrar la auditoría. Al cerrar, la bodega queda libre para empezar
 * otro conteo.
 */

import { useCallback, useEffect, useState, isValidElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, urlBase } from '@/lib/api';

interface FilaConteo {
  nrArticulo: string | null;
  articulo: string;
  familia: string;
  unidad: string;
  contado: number | null;
  sistema: number;
  merma: number;
  enConflicto: boolean;
  metodos: string[];
}

interface Diferencia {
  nrArticulo: string | null;
  articulo: string;
  unidad: string;
  sistema: number;
  contado: number | null;
  diferencia: number;
  merma: number;
  sinExplicar: number | null;
  contadores: string[];
  porContador: { nombre: string; cantidad: number }[];
  anomalias: string[];
  enConflicto: boolean;
}

interface Merma {
  articulo: string;
  cantidad: number;
  unidad: string;
  motivo: string | null;
  incluidoEnConteo: boolean | null;
  fotoUrl: string | null;
  usuario: string;
  capturadoEn: string;
}

interface Traza {
  capturadoEn: string;
  usuario: string;
  articulo: string;
  cantidad: number;
  unidad: string;
  unidadDicha: string | null;
  metodo: string;
  textoCrudo: string | null;
  scoreMatch: number | null;
  anomalias: string[];
  motivoConfirmacion: string | null;
  enConflicto: boolean;
}

interface Reporte {
  bodega: string;
  periodo: string;
  secuencia: number;
  estado: string;
  cerradoEn: string | null;
  notaCierre: string | null;
  resumen: {
    articulosCatalogo: number;
    contados: number;
    sinContar: number;
    conDiferencia: number;
    exactitud: number;
    enConflicto: number;
    articulosConMerma: number;
    descuadresExplicados: number;
  };
  conteo: FilaConteo[];
  diferencias: Diferencia[];
  conflictos: { articulo: string; sistema: number; porContador: { nombre: string; cantidad: number }[] }[];
  mermas: Merma[];
  trazabilidad: Traza[];
}

type Pestana = 'resumen' | 'conteo' | 'diferencias' | 'merma' | 'trazabilidad';

export default function Lider() {
  const { conteoId } = useParams<{ conteoId: string }>();
  const router = useRouter();
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [ampliada, setAmpliada] = useState<Merma | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [nota, setNota] = useState('');
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);

  const cargar = useCallback(() => {
    api<Reporte>(`/conteos/${conteoId}/reporte`)
      .then(setReporte)
      .catch((e) =>
        setError(
          e instanceof Error && e.message.includes('lider')
            ? 'Esta pantalla es solo del líder de costos. Ingresa con ese perfil.'
            : e instanceof Error
              ? e.message
              : 'No se pudo cargar el reporte.',
        ),
      );
  }, [conteoId]);

  useEffect(cargar, [cargar]);

  async function cerrar() {
    setCerrando(true);
    try {
      await api(`/conteos/${conteoId}/cerrar`, {
        method: 'POST',
        body: JSON.stringify({ nota: nota.trim() || undefined }),
      });
      setConfirmandoCierre(false);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cerrar.');
    } finally {
      setCerrando(false);
    }
  }

  async function reabrir() {
    try {
      await api(`/conteos/${conteoId}/reabrir`, { method: 'POST' });
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reabrir.');
    }
  }

  if (error) return <Centro><p className="text-peligro">{error}</p></Centro>;
  if (!reporte) return <Centro><p className="text-tenue">Cargando reporte…</p></Centro>;

  const { resumen } = reporte;
  const cerrado = reporte.estado !== 'ABIERTO';

  const pestanas: [Pestana, string, number][] = [
    ['resumen', 'Resumen', 0],
    ['conteo', 'Conteo', reporte.conteo.length],
    ['diferencias', 'Diferencias', reporte.diferencias.length],
    ['merma', 'Merma', reporte.mermas.length],
    ['trazabilidad', 'Trazabilidad', reporte.trazabilidad.length],
  ];

  return (
    <main className="min-alto-pantalla margen-inferior-seguro mx-auto max-w-5xl px-4 py-5">
      {/*
        En telefono el titulo y la accion NO comparten fila.
        Con "Cerrar conteo" al lado, el nombre de la bodega se truncaba a
        "Kiosco Piscigiro..." — y saber que bodega estas cerrando importa mas
        que ahorrar una fila. A partir de 640 px vuelven a la misma linea,
        donde si caben los dos.
      */}
      <div className="mb-4">
        <button
          onClick={() => router.push('/')}
          className="toque-menor -ml-2 rounded-xl px-2 text-sm text-tenue active:bg-superficie-alta"
        >
          ← Bodegas
        </button>
        <div className="sm:flex sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{reporte.bodega}</h1>
            <p className="text-sm text-tenue">
              Periodo {reporte.periodo}
              {reporte.secuencia > 1 && ` · conteo #${reporte.secuencia}`} ·{' '}
              <span className={cerrado ? 'text-acento' : 'text-alerta-texto'}>
                {cerrado ? 'cerrado' : 'abierto'}
              </span>
              {reporte.cerradoEn &&
                ` el ${new Date(reporte.cerradoEn).toLocaleString('es-CO')}`}
            </p>
          </div>
          {!cerrado && (
            <button
              onClick={() => setConfirmandoCierre(true)}
              className="toque mt-3 w-full shrink-0 rounded-xl bg-acento px-5 font-semibold text-white transition-colors active:bg-[var(--acento-oscuro)] sm:mt-0 sm:w-auto"
            >
              Cerrar conteo
            </button>
          )}
        </div>
      </div>

      {reporte.notaCierre && (
        <p className="tarjeta mb-4 text-sm">
          <span className="text-tenue">Nota del cierre: </span>
          {reporte.notaCierre}
        </p>
      )}

      {cerrado && (
        <div className="tarjeta mb-4 border-acento/50 text-sm">
          <p className="text-acento">Auditoría cerrada.</p>
          <p className="mt-1 text-tenue">
            Esta bodega ya puede empezar un conteo nuevo: entra desde la lista de bodegas y se
            abrirá con la siguiente secuencia.{' '}
            <button onClick={reabrir} className="underline">
              Reabrir este
            </button>
          </p>
        </div>
      )}

      {/* ── Descargas ── */}
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <a
          href={`${urlBase}/conteos/${conteoId}/export.xlsx`}
          className="toque flex items-center rounded-xl bg-superficie-alta px-4 font-medium"
        >
          Excel · 4 hojas
        </a>
        <a
          href={`${urlBase}/conteos/${conteoId}/export.csv`}
          className="toque flex items-center rounded-xl border border-borde-fuerte px-4 font-medium"
        >
          CSV
        </a>
        <a
          href={`/etiquetas/${conteoId}`}
          className="toque flex items-center rounded-xl border border-borde-fuerte px-4 font-medium"
        >
          Etiquetas QR
        </a>
      </div>

      {/* ── Pestañas ── */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {pestanas.map(([id, texto, n]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm ${
              pestana === id
                ? 'border-acento bg-acento/15 text-acento'
                : 'border-borde text-tenue'
            }`}
          >
            {texto}
            {n > 0 && <span className="ml-1 opacity-70">{n}</span>}
          </button>
        ))}
      </div>

      {pestana === 'resumen' && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato valor={resumen.contados} etiqueta="resueltos" />
            <Dato valor={resumen.sinContar} etiqueta="sin contar" alerta={resumen.sinContar > 0} />
            <Dato
              valor={resumen.enConflicto}
              etiqueta="por resolver"
              alerta={resumen.enConflicto > 0}
            />
            <Dato valor={`${resumen.exactitud}%`} etiqueta="exactitud" />
          </div>

          {resumen.articulosConMerma > 0 && (
            <div className="tarjeta mb-5">
              <p className="text-sm">
                <strong className="text-alerta-texto">{resumen.articulosConMerma}</strong> artículo(s)
                con merma registrada, y{' '}
                <strong className="text-acento">{resumen.descuadresExplicados}</strong>{' '}
                descuadre(s) quedan totalmente explicados por ella.
              </p>
              <p className="mt-1 text-xs text-tenue">
                La merma no se resta sola del conteo: se documenta al lado y el reporte muestra
                cuánto del descuadre deja sin explicar.
              </p>
            </div>
          )}

          {reporte.conflictos.length > 0 && (
            <div className="tarjeta mb-5 border-alerta/60">
              <p className="mb-2 text-sm font-medium text-alerta-texto">
                {reporte.conflictos.length} artículo(s) sin cantidad definida
              </p>
              <p className="mb-3 text-sm text-tenue">
                Dos personas reportaron cifras distintas. No se suman solas: puede ser un
                recuento (reemplaza) o dos ubicaciones (suma), y adivinar sería inventar el dato.
              </p>
              <ul className="grid gap-2">
                {reporte.conflictos.map((c) => (
                  <li key={c.articulo} className="rounded-xl bg-superficie-alta p-3 text-sm">
                    <p className="font-medium">{c.articulo}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4 text-tenue">
                      {c.porContador.map((p) => (
                        <span key={p.nombre}>
                          {p.nombre}:{' '}
                          <strong className="tabular-nums text-texto">
                            {p.cantidad.toLocaleString('es-CO')}
                          </strong>
                        </span>
                      ))}
                      <span>· sistema: {c.sistema.toLocaleString('es-CO')}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {pestana === 'conteo' && (
        <Tabla
          cabeceras={['Nr.', 'Artículo', 'Unidad', 'Sistema', 'Contado', 'Merma', 'Método']}
          indiceTitulo={1}
          vacia="Sin artículos."
          filas={reporte.conteo.map((f) => [
            <span key="n" className="font-mono text-xs text-tenue">{f.nrArticulo ?? '—'}</span>,
            <span key="a">
              {f.articulo}
              {f.enConflicto && <span className="ml-2 text-xs text-alerta-texto">conflicto</span>}
            </span>,
            <span key="u" className="text-tenue">{f.unidad}</span>,
            <Num key="s" v={f.sistema} tenue />,
            f.contado === null ? (
              <span key="c" className="text-tenue">—</span>
            ) : (
              <Num key="c" v={f.contado} />
            ),
            f.merma ? <Num key="m" v={f.merma} clase="text-alerta-texto" /> : <span key="m" />,
            <span key="me" className="text-xs text-tenue">{f.metodos.join(', ')}</span>,
          ])}
        />
      )}

      {pestana === 'diferencias' && (
        <Tabla
          cabeceras={['Artículo', 'Sistema', 'Contado', 'Diferencia', 'Merma', 'Sin explicar', 'Contador']}
          vacia="Todo cuadra. No hay diferencias contra el sistema."
          filas={reporte.diferencias.map((d) => [
            <span key="a">
              {d.articulo}
              {d.enConflicto && <span className="ml-2 text-xs text-alerta-texto">conflicto</span>}
            </span>,
            <Num key="s" v={d.sistema} tenue />,
            d.contado === null ? <span key="c" className="text-tenue">—</span> : <Num key="c" v={d.contado} />,
            <Num key="d" v={d.diferencia} clase={d.diferencia < 0 ? 'text-peligro' : 'text-acento'} signo />,
            d.merma ? <Num key="m" v={d.merma} clase="text-alerta-texto" /> : <span key="m" />,
            d.sinExplicar === null ? (
              <span key="x" className="text-tenue">—</span>
            ) : d.sinExplicar === 0 ? (
              <span key="x" className="text-xs text-acento">explicado</span>
            ) : (
              <Num key="x" v={d.sinExplicar} clase="font-semibold" signo />
            ),
            <span key="q" className="text-xs text-tenue">{d.contadores.join(', ')}</span>,
          ])}
        />
      )}

      {pestana === 'merma' && (
        <>
          {reporte.mermas.length === 0 ? (
            <p className="tarjeta text-sm text-tenue">
              Sin mermas registradas en este conteo.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {reporte.mermas.map((m, i) => (
                <li key={i} className="tarjeta flex gap-3">
                  {m.fotoUrl ? (
                    <button
                      onClick={() => setAmpliada(m)}
                      className="shrink-0"
                      aria-label="Ver evidencia"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.fotoUrl.startsWith('http') ? m.fotoUrl : `${urlBase}${m.fotoUrl}`}
                        alt="Evidencia"
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    </button>
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-borde text-[10px] text-tenue">
                      sin foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{m.articulo}</p>
                    <p className="text-lg font-bold tabular-nums text-alerta-texto">
                      {m.cantidad.toLocaleString('es-CO')}{' '}
                      <span className="text-xs font-normal text-tenue">{m.unidad}</span>
                    </p>
                    <p className="text-xs text-tenue">{m.motivo}</p>
                    <p className="mt-1 text-xs text-tenue">
                      {m.usuario} · {new Date(m.capturadoEn).toLocaleString('es-CO')}
                    </p>
                    {m.incluidoEnConteo && (
                      <p className="mt-1 text-xs text-alerta-texto">ya estaba en lo contado</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {pestana === 'trazabilidad' && (
        <Tabla
          cabeceras={['Hora', 'Contador', 'Artículo', 'Cantidad', 'Método', 'Dictado', 'Anomalías']}
          indiceTitulo={2}
          vacia="Sin capturas."
          filas={reporte.trazabilidad.map((t, i) => [
            <span key="h" className="whitespace-nowrap text-xs text-tenue">
              {new Date(t.capturadoEn).toLocaleTimeString('es-CO')}
            </span>,
            <span key="u" className="text-xs">{t.usuario}</span>,
            <span key="a">{t.articulo}</span>,
            <Num key="c" v={t.cantidad} />,
            <span key="m" className="text-xs text-tenue">{t.metodo}</span>,
            <span key="t" className="text-xs italic text-tenue">
              {t.textoCrudo ? `"${t.textoCrudo}"` : ''}
            </span>,
            <span key="an" className="text-xs text-alerta-texto">
              {t.anomalias.join(', ')}
              {t.motivoConfirmacion && (
                <span className="block text-tenue">→ {t.motivoConfirmacion}</span>
              )}
            </span>,
          ])}
          key={`traza-${reporte.trazabilidad.length}`}
        />
      )}

      {/* ── Foto ampliada ── */}
      {ampliada?.fotoUrl && (
        <button
          onClick={() => setAmpliada(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a2540]/95 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ampliada.fotoUrl.startsWith('http') ? ampliada.fotoUrl : `${urlBase}${ampliada.fotoUrl}`}
            alt="Evidencia"
            className="max-h-[75vh] max-w-full rounded-xl object-contain"
          />
          <p className="mt-3 text-center text-sm">
            {ampliada.articulo} · {ampliada.cantidad} {ampliada.unidad} · {ampliada.motivo}
            <span className="block text-xs text-tenue">
              {ampliada.usuario} · {new Date(ampliada.capturadoEn).toLocaleString('es-CO')}
            </span>
          </p>
          <span className="mt-3 text-xs text-tenue">Toca para cerrar</span>
        </button>
      )}

      {/* ── Confirmar cierre ── */}
      {confirmandoCierre && (
        <div className="fixed inset-0 z-50 flex items-end bg-[var(--velo)] p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-2xl border border-borde bg-superficie p-5">
            <h2 className="mb-1 text-lg font-semibold">Cerrar el conteo</h2>
            <p className="mb-4 text-sm text-tenue">
              No entrarán más capturas. La bodega queda libre para empezar otro conteo, y este
              queda firmado con tu nombre y la hora.
              {resumen.sinContar > 0 && (
                <span className="mt-2 block text-alerta-texto">
                  Quedan {resumen.sinContar} artículo(s) sin contar.
                </span>
              )}
              {resumen.enConflicto > 0 && (
                <span className="mt-1 block text-alerta-texto">
                  Hay {resumen.enConflicto} sin cantidad definida; saldrán vacíos en el archivo.
                </span>
              )}
            </p>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nota del cierre (opcional): qué quedó pendiente, por qué se cierra así…"
              rows={3}
              className="mb-4 w-full rounded-xl border border-borde bg-superficie-alta p-3 text-sm outline-none focus:border-acento"
            />
            <div className="grid gap-2">
              <button
                onClick={cerrar}
                disabled={cerrando}
                className="toque rounded-xl bg-acento font-semibold text-white disabled:opacity-40"
              >
                {cerrando ? 'Cerrando…' : 'Cerrar conteo'}
              </button>
              <button
                onClick={() => setConfirmandoCierre(false)}
                className="toque rounded-xl border border-borde"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * ¿La celda no pinta nada? Las filas pasan `<span/>` vacio para "sin dato".
 *
 * La comprobacion se limita a elementos del DOM (`typeof type === 'string'`).
 * Un COMPONENTE no expone su contenido en `props.children` — `<Num v={30.59}/>`
 * recibe `v`, no hijos — asi que mirar `children` a secas lo declaraba vacio y
 * las tarjetas perdian Sistema, Contado y Diferencia: se quedaban con el nombre
 * del articulo y el contador, justo las dos columnas que no son el dato.
 */
function celdaVacia(celda: React.ReactNode) {
  if (celda === null || celda === undefined || celda === false || celda === '') return true;
  if (isValidElement(celda)) {
    if (typeof celda.type !== 'string') return false;
    const hijos = (celda.props as { children?: React.ReactNode }).children;
    return hijos === null || hijos === undefined || hijos === '';
  }
  return false;
}

/**
 * Tabla en pantalla ancha, TARJETAS en telefono.
 *
 * Estas tres tablas tienen siete columnas. Con `overflow-x-auto` la pagina no
 * se rompia, pero en 390 px quedaba un carrusel horizontal en el que hay que
 * arrastrar para ver "Contado" — y esta es justamente la pantalla del cierre,
 * donde el lider compara contra el sistema. Una tabla de siete columnas no
 * cabe en un telefono, y encogerla mas tampoco es la respuesta.
 *
 * Debajo de 640 px cada fila pasa a ser una tarjeta: el articulo como titulo y
 * el resto como pares etiqueta/valor. Se omiten los pares vacios, que en una
 * tabla son celdas en blanco inofensivas pero en una tarjeta serian ruido.
 *
 * Los datos y el orden no cambian: es el MISMO array de filas, presentado de
 * dos maneras segun el ancho. Por eso las tres llamadas siguen intactas.
 */
function Tabla({
  cabeceras,
  filas,
  vacia,
  indiceTitulo = 0,
}: {
  cabeceras: string[];
  filas: React.ReactNode[][];
  vacia: string;
  /** Columna que hace de titulo en la tarjeta (el nombre del articulo). */
  indiceTitulo?: number;
}) {
  if (filas.length === 0) return <p className="tarjeta text-sm text-tenue">{vacia}</p>;

  return (
    <>
      {/* ── Telefono: una tarjeta por fila ── */}
      <ul className="grid grid-cols-1 gap-2 sm:hidden">
        {filas.map((f, i) => (
          <li key={i} className="rounded-xl border border-borde bg-superficie p-3">
            <p className="mb-2 border-b border-borde pb-2 text-sm font-semibold">
              {f[indiceTitulo]}
            </p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {f.map((celda, j) =>
                j === indiceTitulo || celdaVacia(celda) ? null : (
                  <div key={j} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-tenue">
                      {cabeceras[j]}
                    </dt>
                    <dd className="truncate">{celda}</dd>
                  </div>
                ),
              )}
            </dl>
          </li>
        ))}
      </ul>

      {/* ── Tablet y escritorio: la tabla, que aqui si cabe ── */}
      <div className="hidden overflow-x-auto rounded-xl border border-borde sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-borde bg-superficie text-left text-xs text-tenue">
              {cabeceras.map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="border-b border-borde/40 last:border-0">
                {f.map((celda, j) => (
                  <td key={j} className="px-3 py-2 align-top">
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Num({
  v,
  clase = '',
  tenue,
  signo,
}: {
  v: number;
  clase?: string;
  tenue?: boolean;
  signo?: boolean;
}) {
  return (
    <span className={`tabular-nums ${tenue ? 'text-tenue' : ''} ${clase}`}>
      {signo && v > 0 ? '+' : ''}
      {v.toLocaleString('es-CO')}
    </span>
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
      <p className={`text-3xl font-bold tabular-nums ${alerta ? 'text-alerta-texto' : ''}`}>{valor}</p>
      <p className="text-xs text-tenue">{etiqueta}</p>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <main className="flex h-screen items-center justify-center px-6">{children}</main>;
}
