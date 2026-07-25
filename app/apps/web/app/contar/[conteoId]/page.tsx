'use client';

/**
 * Pantalla de conteo. El corazon del producto.
 *
 * Bucle principal, optimizado para tablet sostenida con un brazo:
 *   elegir articulo (lista, voz, busqueda o camara) -> teclear cantidad ->
 *   Guardar y seguir -> avanza solo al siguiente sin contar.
 *
 * Dos taps por articulo. Ese camino funciona sin red, sin voz y sin IA, que es
 * lo que garantiza que el demo no dependa del wifi del sitio.
 *
 * La lista JAMAS muestra la cantidad esperada por el sistema: el conteo es
 * ciego por control de auditoria.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  construirIndice,
  buscar,
  decidir,
  evaluarAnomalias,
  bloquea,
  etiquetaUnidad,
  ETIQUETA_UNIDAD,
  MOTIVOS_CONFIRMACION,
  type Anomalia,
  type Candidato,
  type Unidad,
} from '@conteo/core';
import { api, type Usuario } from '@/lib/api';
import { db, guardarMeta, type ArticuloLocal, type CapturaLocal } from '@/lib/db';
import {
  capturar,
  arrancarSincronizacion,
  pendientes,
  estadoConexion,
  alCambiarConexion,
  type EstadoConexion,
} from '@/lib/sync';
import { escuchar, vozDisponible, type ResultadoVoz } from '@/lib/voz';
import { EscanerCodigo } from '@/components/EscanerCodigo';

interface RespuestaCatalogo {
  conteoId: string;
  bodega: string;
  version: string;
  articulos: ArticuloLocal[];
  codigos: { codigo: string; articuloId: string }[];
}

export default function Contar() {
  const { conteoId } = useParams<{ conteoId: string }>();
  const router = useRouter();

  const [bodega, setBodega] = useState('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [conexion, setConexion] = useState<EstadoConexion>('EN_LINEA');
  const [porEnviar, setPorEnviar] = useState(0);
  const enLinea = conexion === 'EN_LINEA';
  const [codigos, setCodigos] = useState<Map<string, string>>(new Map());

  const articulos = useLiveQuery(() => db.articulos.orderBy('orden').toArray(), [], []);
  const capturas = useLiveQuery(
    () => db.capturas.where('conteoId').equals(conteoId).toArray(),
    [conteoId],
    [],
  );

  // ── Estado del bucle de captura ────────────────────────────────────────
  const [activo, setActivo] = useState<ArticuloLocal | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [metodo, setMetodo] = useState<CapturaLocal['metodo']>('TECLADO');
  const [textoCrudo, setTextoCrudo] = useState<string | null>(null);
  const [scoreMatch, setScoreMatch] = useState<number | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [anomalias, setAnomalias] = useState<Anomalia[] | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [familia, setFamilia] = useState<string>('TODAS');
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const detener = useRef<(() => void) | null>(null);

  const indice = useMemo(
    () => (articulos.length ? construirIndice(articulos) : null),
    [articulos],
  );

  const contadosPorArticulo = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of capturas) m.set(c.articuloId, (m.get(c.articuloId) ?? 0) + c.cantidad);
    return m;
  }, [capturas]);

  // ── Carga inicial: catalogo desde red, o desde IndexedDB si no hay ──────
  useEffect(() => {
    (async () => {
      try {
        const { usuario } = await api<{ usuario: Usuario }>('/auth/yo');
        setUsuario(usuario);
      } catch {
        router.push('/');
        return;
      }

      try {
        const cat = await api<RespuestaCatalogo>(`/conteos/${conteoId}/catalogo`);
        await db.transaction('rw', db.articulos, db.meta, async () => {
          await db.articulos.clear();
          await db.articulos.bulkPut(cat.articulos);
        });
        await guardarMeta('bodega', cat.bodega);
        await guardarMeta('codigos', cat.codigos);
        setBodega(cat.bodega);
        setCodigos(new Map(cat.codigos.map((c) => [c.codigo, c.articuloId])));
      } catch {
        // Sin red: se trabaja con la copia local. Es el caso normal en bodega.
        const guardada = await db.meta.get('bodega');
        const guardados = await db.meta.get('codigos');
        setBodega((guardada?.valor as string) ?? 'Bodega');
        setCodigos(
          new Map(
            ((guardados?.valor as { codigo: string; articuloId: string }[]) ?? []).map((c) => [
              c.codigo,
              c.articuloId,
            ]),
          ),
        );
        if ((await db.articulos.count()) === 0) {
          setErrorCarga(
            'No hay catálogo descargado y no hay red. Conéctate una vez para descargarlo.',
          );
        }
      }
      setCargando(false);
    })();
  }, [conteoId, router]);

  useEffect(() => {
    const parar = arrancarSincronizacion(conteoId);
    const marcar = () => setConexion(estadoConexion());
    marcar();
    const dejarDeOir = alCambiarConexion(setConexion);
    window.addEventListener('online', marcar);
    window.addEventListener('offline', marcar);
    const t = setInterval(async () => {
      setPorEnviar(await pendientes(conteoId));
      marcar();
    }, 1200);
    return () => {
      parar();
      dejarDeOir();
      window.removeEventListener('online', marcar);
      window.removeEventListener('offline', marcar);
      clearInterval(t);
    };
  }, [conteoId]);

  // ── Lista visible ──────────────────────────────────────────────────────
  const familias = useMemo(() => {
    const s = new Set(articulos.map((a) => a.familia));
    return ['TODAS', ...[...s].sort()];
  }, [articulos]);

  const visibles = useMemo(() => {
    let lista = articulos;
    if (familia !== 'TODAS') lista = lista.filter((a) => a.familia === familia);
    if (busqueda.trim().length >= 2 && indice) {
      const res = buscar(indice, busqueda, { limite: 30 });
      const orden = new Map(res.map((r, i) => [r.articulo.id, i]));
      lista = lista
        .filter((a) => orden.has(a.id))
        .sort((a, b) => orden.get(a.id)! - orden.get(b.id)!);
    }
    return lista;
  }, [articulos, familia, busqueda, indice]);

  const siguienteSinContar = useMemo(
    () => visibles.find((a) => !contadosPorArticulo.has(a.id)) ?? null,
    [visibles, contadosPorArticulo],
  );

  // ── Voz ────────────────────────────────────────────────────────────────
  const alResultadoVoz = useCallback(
    (r: ResultadoVoz) => {
      setEscuchando(false);
      setParcial('');
      setTextoCrudo(r.transcripcion);
      setMetodo('VOZ');
      setAvisoVoz(r.avisos[0] ?? null);

      if (r.candidatos.length === 0) {
        setAvisoVoz('No encontré ese artículo. Búscalo por nombre.');
        setBusqueda(r.transcripcion);
        return;
      }

      const decision = decidir(r.candidatos);
      if (decision === 'AUTO') {
        elegirArticulo(r.candidatos[0].articulo as ArticuloLocal, r.candidatos[0].score);
        if (r.cantidad !== null) setCantidad(String(r.cantidad));
        setCandidatos([]);
      } else {
        // Ambiguo: se muestran tarjetas grandes. Equivocarse eligiendo entre
        // cuatro es casi imposible; un auto-aceptado errado entra sucio al
        // sistema, que es justo lo que el reto pide eliminar.
        setCandidatos(r.candidatos);
        if (r.cantidad !== null) setCantidad(String(r.cantidad));
      }
    },
    [],
  );

  function iniciarEscucha() {
    if (!indice) return;
    // La voz depende de los servidores del reconocedor, no de nuestra API:
    // con el servidor caido pero con internet, sigue funcionando. Por eso
    // aqui se mira navigator.onLine y no el estado de sincronizacion.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAvisoVoz('Sin red la voz no está disponible. Usa el teclado.');
      return;
    }
    setEscuchando(true);
    setAvisoVoz(null);
    detener.current = escuchar(indice, alResultadoVoz, setParcial, (m) => {
      setEscuchando(false);
      setParcial('');
      setAvisoVoz(m);
    });
  }

  function terminarEscucha() {
    detener.current?.();
    detener.current = null;
    setEscuchando(false);
  }

  function elegirArticulo(a: ArticuloLocal, score: number | null = null) {
    setActivo(a);
    setScoreMatch(score);
    setCandidatos([]);
    setCantidad('');
  }

  // ── Guardado, con evaluacion de anomalias ANTES de escribir ─────────────
  function intentarGuardar() {
    if (!activo || !usuario) return;
    const valor = Number(cantidad.replace(',', '.'));
    if (!Number.isFinite(valor)) return;

    const yaContadoPor = capturas.find(
      (c) => c.articuloId === activo.id && c.usuarioNombre !== usuario.nombre,
    );

    const detectadas = evaluarAnomalias({
      cantidad: valor,
      unidadCapturada: activo.unidad,
      unidadCatalogo: activo.unidad,
      nombreArticulo: activo.nombre.trim(),
      exp10: activo.exp10,
      scoreMatch,
      scoreSegundo: null,
      yaContadoPor: yaContadoPor?.usuarioNombre ?? null,
    });

    if (detectadas.length > 0) {
      setAnomalias(detectadas);
      setMotivo(null);
      return;
    }
    void guardar(valor, []);
  }

  async function guardar(valor: number, codigos: string[], motivoElegido?: string | null) {
    if (!activo || !usuario) return;

    await capturar({
      clientId: crypto.randomUUID(),
      conteoId,
      articuloId: activo.id,
      articuloNombre: activo.nombre.trim(),
      cantidad: valor,
      unidad: activo.unidad as Unidad,
      metodo,
      textoCrudo,
      scoreMatch,
      anomalias: codigos,
      motivoConfirmacion: motivoElegido ?? null,
      capturadoEn: new Date().toISOString(),
      usuarioNombre: usuario.nombre,
      sincronizada: false,
    });

    setAnomalias(null);
    setCantidad('');
    setTextoCrudo(null);
    setScoreMatch(null);
    setMetodo('TECLADO');
    setAvisoVoz(null);
    // Avanza solo: el contador no vuelve a buscar en la lista.
    setActivo(siguienteSinContar && siguienteSinContar.id !== activo.id ? siguienteSinContar : null);
  }

  if (cargando) return <Pantalla><p className="text-tenue">Cargando catálogo…</p></Pantalla>;
  if (errorCarga) return <Pantalla><p className="text-peligro">{errorCarga}</p></Pantalla>;

  const total = articulos.length;
  const contados = contadosPorArticulo.size;

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col">
      {/* ── Cabecera: progreso y estado de red ── */}
      <header className="flex items-center justify-between border-b border-borde px-4 py-3">
        <div className="min-w-0">
          <button onClick={() => router.push('/')} className="truncate text-left">
            <span className="block truncate font-medium">{bodega}</span>
            <span className="text-xs text-tenue">
              {contados}/{total} artículos · {usuario?.nombre}
            </span>
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Se distingue "sin red" de "el servidor no responde": para el
              contador el efecto es el mismo (sigue contando), pero para quien
              soporta el punto de venta no lo es en absoluto. */}
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              enLinea ? 'bg-acento/20 text-acento' : 'bg-alerta/20 text-alerta'
            }`}
            title={
              conexion === 'SERVIDOR_INALCANZABLE'
                ? 'Hay red, pero el servidor no responde. Lo capturado se guarda y se envía solo cuando vuelva.'
                : conexion === 'SIN_RED'
                  ? 'Sin conexión. Lo capturado se guarda en la tablet y se envía solo al recuperar señal.'
                  : 'Todo sincronizado con el servidor.'
            }
          >
            {conexion === 'EN_LINEA'
              ? 'En línea'
              : conexion === 'SIN_RED'
                ? 'Sin red'
                : 'Servidor no responde'}
            {porEnviar > 0 && ` · ${porEnviar} por enviar`}
          </span>
          {usuario?.rol === 'LIDER' && (
            <button
              onClick={() => router.push(`/lider/${conteoId}`)}
              className="rounded-full border border-borde px-3 py-1 text-xs"
            >
              Cierre
            </button>
          )}
        </div>
      </header>

      <div className="h-1 bg-superficie">
        <div
          className="h-full bg-acento transition-all"
          style={{ width: `${total ? (contados / total) * 100 : 0}%` }}
        />
      </div>

      {/* ── Lista de articulos (sin cantidades del sistema) ── */}
      <section className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {familias.map((f) => (
            <button
              key={f}
              onClick={() => setFamilia(f)}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs ${
                familia === f ? 'border-acento bg-acento/15 text-acento' : 'border-borde text-tenue'
              }`}
            >
              {f === 'TODAS' ? 'Todas' : f.replaceAll('_', ' ').toLowerCase()}
            </button>
          ))}
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar artículo…"
          className="toque mb-3 w-full rounded-xl border border-borde bg-superficie px-4 text-base outline-none focus:border-acento"
        />

        <ul className="grid gap-2 pb-4">
          {visibles.slice(0, 120).map((a) => {
            const contado = contadosPorArticulo.get(a.id);
            const esActivo = activo?.id === a.id;
            return (
              <li key={a.id}>
                <button
                  onClick={() => elegirArticulo(a)}
                  className={`toque flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
                    esActivo
                      ? 'border-acento bg-acento/10'
                      : contado !== undefined
                        ? 'border-borde bg-superficie/60'
                        : 'border-borde bg-superficie'
                  }`}
                >
                  <span className="min-w-0 pr-3">
                    <span className="block truncate text-[15px]">{a.nombre.trim()}</span>
                    <span className="text-xs text-tenue">
                      {ETIQUETA_UNIDAD[a.unidad as Unidad].plural}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {contado !== undefined ? (
                      <span className="font-semibold text-acento">
                        {contado.toLocaleString('es-CO')}
                      </span>
                    ) : (
                      <span className="text-tenue">—</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Zona de captura, siempre en la mitad inferior ── */}
      <section className="border-t border-borde bg-superficie/70 px-4 pb-5 pt-3 backdrop-blur">
        {avisoVoz && (
          <p className="mb-2 rounded-lg bg-alerta/15 px-3 py-2 text-sm text-alerta">{avisoVoz}</p>
        )}

        {candidatos.length > 0 && (
          <div className="mb-3">
            <p className="mb-2 text-sm text-tenue">¿Cuál de estos es?</p>
            <div className="grid grid-cols-2 gap-2">
              {candidatos.slice(0, 4).map((c) => (
                <button
                  key={c.articulo.id}
                  onClick={() => elegirArticulo(c.articulo as ArticuloLocal, c.score)}
                  className="rounded-xl border border-borde bg-superficie-alta p-3 text-left text-sm"
                  style={{ minHeight: 76 }}
                >
                  {/* Se resalta lo que DIFERENCIA a cada candidato: entre ocho
                      cuchillos, lo util es ver "VERDE" vs "AMARILLO". */}
                  <span className="block">
                    {c.tokensCompartidos.length > 0 && (
                      <span className="text-tenue">{c.tokensCompartidos.join(' ')} </span>
                    )}
                    <span className="font-semibold">{c.tokensDiferenciadores.join(' ')}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activo ? (
          <>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-medium">{activo.nombre.trim()}</p>
                <p className="text-xs text-tenue">
                  se cuenta en {ETIQUETA_UNIDAD[activo.unidad as Unidad].plural}
                </p>
              </div>
              <p className="shrink-0 text-4xl font-bold tabular-nums text-acento">
                {cantidad || '0'}
              </p>
            </div>

            <div className="mb-2 grid grid-cols-4 gap-2">
              {['7', '8', '9', '1', '4', '5', '6', '2', '1', '2', '3', '3'].slice(0, 0)}
              {['7', '8', '9'].map((d) => (
                <Tecla key={d} onClick={() => setCantidad(cantidad + d)}>{d}</Tecla>
              ))}
              <Tecla onClick={() => setCantidad('')} tenue>C</Tecla>
              {['4', '5', '6'].map((d) => (
                <Tecla key={d} onClick={() => setCantidad(cantidad + d)}>{d}</Tecla>
              ))}
              <Tecla onClick={() => setCantidad(cantidad.slice(0, -1))} tenue>⌫</Tecla>
              {['1', '2', '3'].map((d) => (
                <Tecla key={d} onClick={() => setCantidad(cantidad + d)}>{d}</Tecla>
              ))}
              <Tecla
                onClick={() => setCantidad(cantidad.includes(',') ? cantidad : (cantidad || '0') + ',')}
                tenue
              >
                ,
              </Tecla>
              <Tecla onClick={() => setCantidad(cantidad + '0')}>0</Tecla>
              {/* Medio kilo es un caso real y frecuente: paquete abierto que se pesa. */}
              <Tecla onClick={() => setCantidad(((Number(cantidad.replace(',', '.')) || 0) + 0.5).toString().replace('.', ','))} tenue>
                +½
              </Tecla>
              <button
                onClick={intentarGuardar}
                disabled={cantidad === ''}
                className="col-span-2 rounded-xl bg-acento text-lg font-semibold text-black disabled:opacity-40"
                style={{ minHeight: 64 }}
              >
                Guardar y seguir
              </button>
            </div>

            <button
              onClick={() => {
                setActivo(null);
                setCantidad('');
              }}
              className="w-full py-2 text-sm text-tenue"
            >
              Cancelar
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-tenue">
                {parcial ? (
                  <span className="text-white">{parcial}…</span>
                ) : siguienteSinContar ? (
                  <>
                    Siguiente:{' '}
                    <button
                      onClick={() => elegirArticulo(siguienteSinContar)}
                      className="text-white underline"
                    >
                      {siguienteSinContar.nombre.trim()}
                    </button>
                  </>
                ) : (
                  'Todo contado en esta vista.'
                )}
              </p>
            </div>

            <button
              onClick={() => setEscaneando(true)}
              className="toque rounded-xl border border-borde px-4 text-sm"
              title="Escanear código o QR de estante"
            >
              Escanear
            </button>

            <button
              className="microfono bg-acento text-black disabled:opacity-40"
              data-escuchando={escuchando}
              disabled={!vozDisponible()}
              onPointerDown={iniciarEscucha}
              onPointerUp={terminarEscucha}
              onPointerLeave={terminarEscucha}
              aria-label="Mantén presionado para dictar"
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
                <path d="M18 11a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.917V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.083A6 6 0 0 0 18 11Z" />
              </svg>
            </button>
          </div>
        )}
      </section>

      {escaneando && (
        <EscanerCodigo
          codigos={codigos}
          articulos={articulos}
          onCerrar={() => setEscaneando(false)}
          onArticulo={(a) => {
            setEscaneando(false);
            setMetodo('CAMARA');
            elegirArticulo(a);
          }}
        />
      )}

      {anomalias && activo && (
        <DialogoAnomalias
          anomalias={anomalias}
          cantidad={Number(cantidad.replace(',', '.'))}
          articulo={activo}
          motivo={motivo}
          setMotivo={setMotivo}
          onReteclear={() => {
            setAnomalias(null);
            setCantidad('');
          }}
          onCorregir={(v) => {
            setAnomalias(null);
            setCantidad(String(v).replace('.', ','));
          }}
          onAceptar={() =>
            guardar(Number(cantidad.replace(',', '.')), anomalias.map((a) => a.codigo), motivo)
          }
        />
      )}
    </main>
  );
}

function Tecla({
  children,
  onClick,
  tenue,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tenue?: boolean;
}) {
  return (
    <button onClick={onClick} className={`tecla ${tenue ? 'text-tenue' : ''}`}>
      {children}
    </button>
  );
}

/**
 * Dialogo de confirmacion.
 *
 * Tres decisiones deliberadas, defendibles ante quien conoce el proceso:
 *  1. Nunca aparece un numero del sistema, solo el que capturo la persona.
 *  2. La accion primaria es VOLVER A TECLEAR, no aceptar: re-teclear es el
 *     mecanismo que de verdad mata el error; aceptar solo lo documenta.
 *  3. Aceptar exige un motivo. Esos motivos son la columna que EXPLICA los
 *     descuadres en el reporte, en vez de solo listarlos.
 */
function DialogoAnomalias({
  anomalias,
  cantidad,
  articulo,
  motivo,
  setMotivo,
  onReteclear,
  onCorregir,
  onAceptar,
}: {
  anomalias: Anomalia[];
  cantidad: number;
  articulo: ArticuloLocal;
  motivo: string | null;
  setMotivo: (m: string) => void;
  onReteclear: () => void;
  onCorregir: (v: number) => void;
  onAceptar: () => void;
}) {
  const hayBloqueo = bloquea(anomalias);
  const principal = anomalias[0];
  const correcciones = anomalias.flatMap(
    (a) => a.opciones?.filter((o) => o.accion === 'CORREGIR_A') ?? [],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-2xl border border-alerta/60 bg-superficie p-5">
        <p className="mb-1 text-sm font-semibold text-alerta">⚠ {principal.titulo}</p>
        <p className="mb-4 text-sm text-tenue">{principal.mensaje}</p>

        <div className="mb-4 rounded-xl bg-superficie-alta p-4">
          <p className="text-sm text-tenue">{articulo.nombre.trim()}</p>
          <p className="text-3xl font-bold tabular-nums">
            {cantidad.toLocaleString('es-CO')}{' '}
            <span className="text-base font-normal text-tenue">
              {etiquetaUnidad(articulo.unidad as Unidad, cantidad)}
            </span>
          </p>
        </div>

        {anomalias.length > 1 && (
          <ul className="mb-4 grid gap-1 text-xs text-tenue">
            {anomalias.slice(1).map((a) => (
              <li key={a.codigo}>· {a.mensaje}</li>
            ))}
          </ul>
        )}

        <div className="grid gap-2">
          <button
            onClick={onReteclear}
            className="toque rounded-xl bg-acento text-base font-semibold text-black"
          >
            Volver a teclear
          </button>

          {correcciones.map((o) => (
            <button
              key={o.etiqueta}
              onClick={() => onCorregir(o.valor!)}
              className="toque rounded-xl border border-borde text-base"
            >
              {o.etiqueta}
            </button>
          ))}

          {!hayBloqueo && (
            <>
              <p className="mt-2 text-xs text-tenue">Si es correcto, indica por qué:</p>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS_CONFIRMACION.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMotivo(m)}
                    className={`rounded-full border px-3 py-2 text-xs ${
                      motivo === m ? 'border-acento bg-acento/15 text-acento' : 'border-borde text-tenue'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button
                onClick={onAceptar}
                disabled={!motivo}
                className="toque rounded-xl border border-borde text-base disabled:opacity-40"
              >
                Es correcto, guardar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Pantalla({ children }: { children: React.ReactNode }) {
  return <main className="flex h-screen items-center justify-center px-6">{children}</main>;
}
