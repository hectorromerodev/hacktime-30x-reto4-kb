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
import {
  db,
  guardarMeta,
  type ArticuloLocal,
  type CapturaLocal,
  type TipoCaptura,
} from '@/lib/db';
import { prepararFoto, MOTIVOS_MERMA, type FotoPreparada } from '@/lib/foto';
import { rangoHabitual } from '@/lib/rangoHabitual';
import {
  capturar,
  arrancarSincronizacion,
  pendientes,
  estadoConexion,
  alCambiarConexion,
  type EstadoConexion,
} from '@/lib/sync';
import { escuchar, vozDisponible, pedirPermisoMicrofono, type ResultadoVoz } from '@/lib/voz';
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

  // ── Merma ──────────────────────────────────────────────────────────────
  /** CONTEO cuenta existencias; MERMA da de baja producto que no sirve. */
  const [tipo, setTipo] = useState<TipoCaptura>('CONTEO');
  const [motivoMerma, setMotivoMerma] = useState<string | null>(null);
  const [incluidoEnConteo, setIncluidoEnConteo] = useState(false);
  const [foto, setFoto] = useState<FotoPreparada | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);

  function limpiarMerma() {
    setMotivoMerma(null);
    setIncluidoEnConteo(false);
    setFoto(null);
    setErrorFoto(null);
  }

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    setErrorFoto(null);
    try {
      setFoto(await prepararFoto(archivo));
    } catch (e) {
      setErrorFoto(e instanceof Error ? e.message : 'No se pudo procesar la imagen.');
    }
  }
  /** Confirmacion de lo ultimo guardado; reemplaza al avance automatico. */
  const [ultimoContado, setUltimoContado] = useState<{
    nombre: string;
    cantidad: number;
    unidad: Unidad;
  } | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [familia, setFamilia] = useState<string>('TODAS');
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState('');

  /**
   * Dictado continuo: el micrófono se vuelve a abrir solo tras cada frase, y
   * lo que se entiende sin ambigüedad se guarda sin pedir confirmación.
   *
   * "Sin ambigüedad" es estricto a propósito: coincidencia de artículo por
   * encima del umbral de auto-aceptación, cantidad reconocida, y ninguna
   * anomalía. Cualquier otra cosa detiene el dictado y pregunta. Guardar a
   * ciegas por ir rápido sería el error que este producto elimina.
   */
  const [continuo, setContinuo] = useState(false);
  useEffect(() => {
    setContinuo(localStorage.getItem('dictadoContinuo') === '1');
  }, []);
  const modoContinuo = useRef(false);
  modoContinuo.current = continuo;
  /** Lo pone el usuario al soltar/cancelar: corta la cadena de reinicios. */
  const detenidoAMano = useRef(false);
  /** Errores seguidos; con varios se apaga solo para no entrar en bucle. */
  const fallosSeguidos = useRef(0);
  const [dictados, setDictados] = useState(0);

  /**
   * El manejador de voz se crea una sola vez (useCallback sin dependencias),
   * así que lee usuario y capturas por referencia en vez de capturarlos.
   */
  const usuarioRef = useRef<Usuario | null>(null);
  const capturasRef = useRef<CapturaLocal[]>([]);
  /** Para no reabrir el micrófono mientras hay un diálogo esperando. */
  const anomaliasRef = useRef<Anomalia[] | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const detener = useRef<(() => void) | null>(null);
  /** Momento del pointerdown, para distinguir un toque de un mantener. */
  const inicioPulsacion = useRef(0);
  const permisoOk = useRef(false);

  usuarioRef.current = usuario;
  capturasRef.current = capturas;
  anomaliasRef.current = anomalias;

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
      let yo: Usuario;
      try {
        const r = await api<{ usuario: Usuario }>('/auth/yo');
        yo = r.usuario;
        setUsuario(yo);
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

        // Se recuperan las capturas PROPIAS del servidor, para poder retomar
        // el conteo en otra tablet. Nunca las de otros contadores: el conteo
        // tambien es ciego entre ellos, que es el control de auditoria.
        try {
          const mias = await api<{ capturas: CapturaLocal[] }>(
            `/conteos/${conteoId}/capturas/mias`,
          );
          if (mias.capturas.length) {
            await db.capturas.bulkPut(
              mias.capturas.map((c) => ({
                ...c,
                conteoId,
                usuarioNombre: yo.nombre,
                // Vienen del servidor: ya estan sincronizadas y NO se encolan.
                sincronizada: true,
              })),
            );
          }
        } catch {
          // Sin esto se sigue contando igual; solo no se ve lo previo.
        }
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

  // Se avisa de entrada si el navegador no reconoce voz, en vez de dejar que
  // el contador descubra al tercer intento que el boton no hace nada.
  useEffect(() => {
    if (!vozDisponible()) {
      setAvisoVoz('Este navegador no reconoce voz. Cuenta con el teclado o la búsqueda.');
    }
  }, []);

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
  /**
   * Guarda directo, sin pasar por la pantalla de captura.
   *
   * Devuelve `true` si se guardó. Si devuelve `false` es porque saltó una
   * anomalía: deja el artículo cargado y el diálogo abierto para resolverlo.
   */
  const capturarDirecto = useCallback(
    async (
      a: ArticuloLocal,
      valor: number,
      opciones: { metodo: CapturaLocal['metodo']; textoCrudo?: string | null; score?: number | null },
    ): Promise<boolean> => {
      const yo = usuarioRef.current;
      if (!yo) return false;

      const yaContadoPor = capturasRef.current.find(
        (c) => c.articuloId === a.id && c.usuarioNombre !== yo.nombre,
      );
      const detectadas = evaluarAnomalias({
        cantidad: valor,
        unidadCapturada: a.unidad as Unidad,
        unidadCatalogo: a.unidad as Unidad,
        nombreArticulo: a.nombre.trim(),
        exp10: a.exp10,
        scoreMatch: opciones.score ?? null,
        yaContadoPor: yaContadoPor?.usuarioNombre ?? null,
      });

      if (detectadas.length > 0) {
        setMetodo(opciones.metodo);
        setTextoCrudo(opciones.textoCrudo ?? null);
        elegirArticulo(a, opciones.score ?? null);
        setCantidad(String(valor).replace('.', ','));
        setAnomalias(detectadas);
        setMotivo(null);
        return false;
      }

      await capturar({
        clientId: crypto.randomUUID(),
        conteoId,
        articuloId: a.id,
        articuloNombre: a.nombre.trim(),
        cantidad: valor,
        unidad: a.unidad as Unidad,
        metodo: opciones.metodo,
        textoCrudo: opciones.textoCrudo ?? null,
        scoreMatch: opciones.score ?? null,
        anomalias: [],
        capturadoEn: new Date().toISOString(),
        usuarioNombre: yo.nombre,
        sincronizada: false,
      });
      setUltimoContado({
        nombre: a.nombre.trim(),
        cantidad: valor,
        unidad: a.unidad as Unidad,
      });
      return true;
    },
    [conteoId],
  );

  const alResultadoVoz = useCallback(
    (r: ResultadoVoz) => {
      setEscuchando(false);
      setParcial('');
      setTextoCrudo(r.transcripcion);
      setMetodo('VOZ');
      setAvisoVoz(r.avisos[0] ?? null);

      // ── Dictado continuo ────────────────────────────────────────────
      // Solo se guarda solo cuando NO hay nada que interpretar: artículo
      // inequívoco y cantidad reconocida. Si falta cualquiera de las dos,
      // cae al camino normal y el dictado se detiene para preguntar.
      if (
        modoContinuo.current &&
        r.candidatos.length > 0 &&
        r.cantidad !== null &&
        decidir(r.candidatos) === 'AUTO'
      ) {
        const c = r.candidatos[0];
        void capturarDirecto(c.articulo as ArticuloLocal, r.cantidad, {
          metodo: 'VOZ',
          textoCrudo: r.transcripcion,
          score: c.score,
        }).then((guardado) => {
          if (guardado) {
            setDictados((n) => n + 1);
            setAvisoVoz(null);
          } else {
            // Saltó una anomalía: se corta la cadena y se resuelve a mano.
            detenidoAMano.current = true;
          }
        });
        return;
      }

      if (r.candidatos.length === 0) {
        // Se repite lo que se entendió: deja ver de un vistazo si el
        // reconocedor oyó mal o si el producto no está en esta bodega.
        setAvisoVoz(
          `Entendí "${r.transcripcion}", pero no encontré ese artículo en esta bodega. ` +
            'Lo dejé en el buscador para que lo ajustes.',
        );
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

  /**
   * Arranca la escucha. Se llama DIRECTO desde el manejador del gesto, sin
   * ningun `await` antes: Safari exige que `start()` ocurra dentro del gesto
   * del usuario, y meter una promesa en medio lo invalida. Por eso el permiso
   * de microfono se diagnostica DESPUES de fallar, no antes de empezar.
   */
  function iniciarEscucha() {
    if (!indice || escuchando) return;
    // La voz depende de los servidores del reconocedor, no de nuestra API:
    // con el servidor caido pero con internet, sigue funcionando. Por eso
    // aqui se mira navigator.onLine y no el estado de sincronizacion.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAvisoVoz('Sin red la voz no está disponible. Usa el teclado.');
      return;
    }

    setEscuchando(true);
    setAvisoVoz(null);

    detener.current = escuchar(
      indice,
      alResultadoVoz,
      setParcial,
      (m) => {
        setEscuchando(false);
        setParcial('');
        setAvisoVoz(m);
        // "No se escuchó nada" es normal entre frases del dictado continuo;
        // el resto de errores sí cuentan para apagarlo.
        if (!m.startsWith('No se escuchó')) fallosSeguidos.current += 1;
        // Si el navegador dijo que no hay permiso, se averigua el motivo real
        // para poder decirle al contador que hacer.
        if (m.includes('bloqueado') && !permisoOk.current) {
          void pedirPermisoMicrofono().then((r) => {
            if (r.ok) permisoOk.current = true;
            else setAvisoVoz(r.motivo);
          });
        }
      },
      () => {
        setEscuchando(false);
        // Dictado continuo: se vuelve a abrir el micrófono solo. Se corta si
        // el contador lo detuvo, si hay un diálogo abierto, o tras varios
        // fallos seguidos — un reinicio ciego en bucle vaciaría la batería.
        if (
          modoContinuo.current &&
          !detenidoAMano.current &&
          fallosSeguidos.current < 3 &&
          !anomaliasRef.current
        ) {
          setTimeout(() => {
            if (modoContinuo.current && !detenidoAMano.current) iniciarEscucha();
          }, 350);
        }
      },
    );
  }

  function terminarEscucha() {
    detener.current?.();
    detener.current = null;
    setEscuchando(false);
  }

  /**
   * Gesto tolerante: sirve manteniendo presionado Y tocando.
   *
   * Antes solo funcionaba manteniendo: un toque normal arrancaba y cortaba a
   * los ~100 ms, antes de que a nadie le diera tiempo de hablar, y parecia que
   * "el audio no jala". Ahora una pulsacion corta deja el microfono abierto
   * hasta que el reconocedor detecta el final de la frase o se toca de nuevo.
   */
  const UMBRAL_TOQUE_MS = 400;

  function alPresionarMicrofono() {
    if (escuchando) {
      // Segundo toque durante la escucha: cierra.
      detenidoAMano.current = true;
      terminarEscucha();
      inicioPulsacion.current = 0;
      return;
    }
    detenidoAMano.current = false;
    fallosSeguidos.current = 0;
    inicioPulsacion.current = performance.now();
    iniciarEscucha();
  }

  function alSoltarMicrofono() {
    if (!inicioPulsacion.current) return;
    const duracion = performance.now() - inicioPulsacion.current;
    inicioPulsacion.current = 0;
    // En dictado continuo el micrófono se queda abierto pase lo que pase:
    // la idea es encadenar frases sin volver a tocar nada.
    if (modoContinuo.current) return;
    // Mantener presionado -> se cierra al soltar.
    // Toque corto -> se deja abierto; el reconocedor cierra solo al terminar
    // la frase, o el contador vuelve a tocar.
    if (duracion >= UMBRAL_TOQUE_MS) terminarEscucha();
  }

  function cambiarContinuo(valor: boolean) {
    setContinuo(valor);
    localStorage.setItem('dictadoContinuo', valor ? '1' : '0');
    if (!valor) {
      detenidoAMano.current = true;
      terminarEscucha();
    } else {
      setDictados(0);
    }
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

    // ── Merma ────────────────────────────────────────────────────────
    // Una baja no es un conteo: no se compara contra la escala del sistema
    // ni compite con otro contador. Dar de baja 900 litros no es una
    // anomalía, es una noticia. Lo único que se exige es el motivo, porque
    // sin él el registro no sirve para agrupar después.
    if (tipo === 'MERMA') {
      if (!motivoMerma) return;
      void guardarMerma(valor);
      return;
    }

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

  /** Registra una baja. La foto viaja aparte y se sube cuando haya red. */
  async function guardarMerma(valor: number) {
    if (!activo || !usuario || !motivoMerma) return;

    await capturar(
      {
        clientId: crypto.randomUUID(),
        conteoId,
        articuloId: activo.id,
        articuloNombre: activo.nombre.trim(),
        cantidad: valor,
        unidad: activo.unidad as Unidad,
        tipo: 'MERMA',
        motivoMerma,
        incluidoEnConteo,
        metodo,
        textoCrudo,
        anomalias: [],
        capturadoEn: new Date().toISOString(),
        usuarioNombre: usuario.nombre,
        sincronizada: false,
      },
      foto ? { datos: foto.datos, tipoContenido: foto.tipoContenido } : undefined,
    );

    setUltimoContado({
      nombre: `${activo.nombre.trim()} · baja por ${motivoMerma.toLowerCase()}`,
      cantidad: valor,
      unidad: activo.unidad as Unidad,
    });
    setCantidad('');
    setTextoCrudo(null);
    setActivo(null);
    limpiarMerma();
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

    // NO se selecciona solo el siguiente de la lista.
    //
    // El orden de la lista es el de la hoja del sistema, que no tiene por que
    // coincidir con el recorrido real del almacen: el contador va por lo que
    // tiene enfrente en el estante. Preseleccionar le obligaba a cancelar para
    // contar lo que de verdad seguia.
    //
    // Queda libre: dicta, escanea o toca el articulo que sigue en SU acomodo.
    // El siguiente sin contar se ofrece como atajo de un toque, no impuesto.
    setUltimoContado({ nombre: activo.nombre.trim(), cantidad: valor, unidad: activo.unidad as Unidad });
    setActivo(null);
  }

  if (cargando) return <Pantalla><p className="text-tenue">Cargando catálogo…</p></Pantalla>;
  if (errorCarga) return <Pantalla><p className="text-peligro">{errorCarga}</p></Pantalla>;

  const total = articulos.length;
  const contados = contadosPorArticulo.size;

  return (
    <main className="alto-pantalla mx-auto flex max-w-2xl flex-col overflow-hidden">
      {/* ── Cabecera: progreso y estado de red ── */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-borde px-3 py-3">
        {/* Salida explícita. Antes el nombre de la bodega era el único modo de
            volver, y no se veía como un botón: tocaba usar el "atrás" del
            navegador. */}
        <button
          onClick={() => router.push('/')}
          aria-label="Salir de esta bodega"
          className="toque flex shrink-0 items-center rounded-xl border border-borde px-3 text-lg"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={() => router.push('/')} className="w-full truncate text-left">
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

      <div className="h-1 shrink-0 bg-superficie">
        <div
          className="h-full bg-acento transition-all"
          style={{ width: `${total ? (contados / total) * 100 : 0}%` }}
        />
      </div>

      {/* ── Lista de articulos (sin cantidades del sistema) ── */}
      {/* min-h-0 es obligatorio: sin el, un hijo flex se niega a encogerse por
          debajo de su contenido y empuja la zona de captura fuera del marco. */}
      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
      <section className="margen-inferior-seguro shrink-0 border-t border-borde bg-superficie/70 px-4 pt-3 backdrop-blur">
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

        {/* Conteo o baja. Se mantiene entre artículos: quien va dando de baja
            un lote vencido registra varios seguidos sin volver a cambiar. */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(['CONTEO', 'MERMA'] as TipoCaptura[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTipo(t);
                if (t === 'CONTEO') limpiarMerma();
              }}
              className={`rounded-xl border py-2 text-sm font-medium ${
                tipo === t
                  ? t === 'MERMA'
                    ? 'border-alerta bg-alerta/15 text-alerta'
                    : 'border-acento bg-acento/15 text-acento'
                  : 'border-borde text-tenue'
              }`}
            >
              {t === 'CONTEO' ? 'Contar existencias' : 'Registrar merma'}
            </button>
          ))}
        </div>

        {activo ? (
          <>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-medium">{activo.nombre.trim()}</p>
                <p className="text-xs text-tenue">
                  {/* El número de catálogo va visible para poder cotejarlo
                      contra el producto que se tiene en la mano. */}
                  {activo.nrArticulo && (
                    <span className="font-mono">Nr. {activo.nrArticulo} · </span>
                  )}
                  se cuenta en {ETIQUETA_UNIDAD[activo.unidad as Unidad].plural}
                </p>
              </div>
              <p className="shrink-0 text-4xl font-bold tabular-nums text-acento">
                {cantidad || '0'}
              </p>
            </div>

            {/* ── Datos que solo pide la merma ─────────────────────────── */}
            {tipo === 'MERMA' && (
              <div className="mb-3 rounded-xl border border-alerta/40 bg-alerta/5 p-3">
                <p className="mb-2 text-xs text-tenue">¿Por qué se da de baja?</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {MOTIVOS_MERMA.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMotivoMerma(m)}
                      className={`rounded-full border px-3 py-2 text-xs ${
                        motivoMerma === m
                          ? 'border-alerta bg-alerta/20 text-alerta'
                          : 'border-borde text-tenue'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Colsubsidio no aclaró si el producto dañado se retira antes
                    del conteo. En vez de imponer una regla, se pregunta: con
                    eso el reporte calcula bien el descuadre. */}
                <label className="mb-3 flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={incluidoEnConteo}
                    onChange={(e) => setIncluidoEnConteo(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-alerta"
                  />
                  <span className="text-tenue">
                    Este producto <strong className="text-white">ya lo conté</strong> como
                    existencia (sigue en el estante)
                  </span>
                </label>

                {/* Evidencia. Opcional: exigir foto para registrar una baja
                    haría que la gente simplemente no la registre. */}
                <input
                  ref={entradaFoto}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void elegirFoto(e.target.files?.[0])}
                />
                {foto ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={foto.vistaPrevia}
                      alt="Evidencia"
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1 text-xs text-tenue">
                      <p className="text-acento">✓ evidencia lista</p>
                      <p>{Math.round(foto.bytes / 1024)} KB</p>
                    </div>
                    <button
                      onClick={() => setFoto(null)}
                      className="rounded-lg border border-borde px-3 py-2 text-xs"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => entradaFoto.current?.click()}
                    className="toque w-full rounded-xl border border-borde text-sm"
                  >
                    Tomar foto de evidencia (opcional)
                  </button>
                )}
                {errorFoto && <p className="mt-2 text-xs text-peligro">{errorFoto}</p>}
              </div>
            )}

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
                disabled={cantidad === '' || (tipo === 'MERMA' && !motivoMerma)}
                className={`col-span-2 rounded-xl text-lg font-semibold text-black disabled:opacity-40 ${
                  tipo === 'MERMA' ? 'bg-alerta' : 'bg-acento'
                }`}
                style={{ minHeight: 64 }}
              >
                {tipo === 'MERMA' ? 'Registrar baja' : 'Guardar'}
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
              {escuchando ? (
                <p className="text-sm font-medium text-acento">
                  {parcial ? <span className="text-white">{parcial}…</span> : 'Escuchando… habla ahora'}
                </p>
              ) : parcial ? (
                <p className="text-sm text-white">{parcial}…</p>
              ) : (
                <>
                  {/* Confirmacion de lo guardado. Sustituye al avance
                      automatico: informa sin arrastrar al contador a otro
                      articulo. */}
                  {ultimoContado && (
                    <p className="truncate text-sm">
                      <span className="text-acento">✓ </span>
                      <span className="text-tenue">
                        {ultimoContado.nombre} ·{' '}
                        {ultimoContado.cantidad.toLocaleString('es-CO')}{' '}
                        {ETIQUETA_UNIDAD[ultimoContado.unidad].corta}
                      </span>
                    </p>
                  )}
                  <p className="truncate text-sm text-tenue">
                    {siguienteSinContar ? (
                      <>
                        Dicta, escanea o toca el que sigue. Atajo:{' '}
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
                </>
              )}
            </div>

            {/* Dictado continuo: el micrófono se reabre solo tras cada frase
                y lo inequívoco se guarda sin preguntar. */}
            <label className="flex shrink-0 flex-col items-center gap-1 text-[11px] text-tenue">
              <input
                type="checkbox"
                checked={continuo}
                onChange={(e) => cambiarContinuo(e.target.checked)}
                className="h-6 w-10 accent-acento"
              />
              continuo
              {continuo && dictados > 0 && (
                <span className="text-acento">{dictados}</span>
              )}
            </label>

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
              // Ya NO se cancela en onPointerLeave: al sostener el boton en una
              // tablet el dedo se mueve unos pixeles y salia del elemento,
              // matando la captura a media frase.
              onPointerDown={alPresionarMicrofono}
              onPointerUp={alSoltarMicrofono}
              onPointerCancel={terminarEscucha}
              aria-label={escuchando ? 'Escuchando, toca para terminar' : 'Toca o mantén presionado para dictar'}
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
          onArticulo={(a, codigo) => {
            setEscaneando(false);
            setMetodo('CAMARA');
            elegirArticulo(a);
            // Queda en la hoja de trazabilidad con qué código se resolvió: si
            // una etiqueta de estante está mal pegada, se ve en el reporte.
            setTextoCrudo(codigo);
          }}
          /**
           * Modo automático: guarda sin cerrar la cámara, para poder recorrer
           * un estante encadenando lecturas.
           *
           * Pasa por las MISMAS reglas de anomalía que el resto: si algo salta,
           * devuelve false, se cierra la cámara y el diálogo se resuelve en la
           * pantalla de conteo. Saltarse la verificación por ir rápido sería
           * exactamente el error que este producto elimina.
           */
          onCapturaRapida={async (a, valor, codigo) => {
            // Mismo camino que el dictado continuo: una sola implementación
            // de las reglas, para que las dos vías no puedan divergir.
            const guardado = await capturarDirecto(a, valor, {
              metodo: 'CAMARA',
              textoCrudo: codigo,
            });
            // Si saltó una anomalía hay que salir de la cámara para resolverla.
            if (!guardado) setEscaneando(false);
            return guardado;
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
  const [porQue, setPorQue] = useState(false);
  const correcciones = anomalias.flatMap(
    (a) => a.opciones?.filter((o) => o.accion === 'CORREGIR_A') ?? [],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-2xl border border-alerta/60 bg-superficie p-5">
        <p className="mb-1 text-sm font-semibold text-alerta">⚠ {principal.titulo}</p>
        <p className="mb-4 text-sm text-tenue">{principal.mensaje}</p>

        {principal.codigo === 'R8_SALTO_DE_MAGNITUD' && articulo.exp10 != null && (
          <div className="mb-4">
            <button
              onClick={() => setPorQue((v) => !v)}
              className="text-xs text-tenue underline underline-offset-2"
            >
              ¿Por qué?
            </button>
            {porQue && (
              <p className="mt-1 text-xs text-tenue">
                En esta bodega suele estar {rangoHabitual(articulo.exp10)}.
              </p>
            )}
          </div>
        )}

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
