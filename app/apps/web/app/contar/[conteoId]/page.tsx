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
import { Hoja } from '@/components/ui/Hoja';

interface RespuestaCatalogo {
  conteoId: string;
  bodega: string;
  version: string;
  articulos: ArticuloLocal[];
  codigos: { codigo: string; articuloId: string }[];
}

/**
 * ¿Se muestra el interruptor de dictado seguido?
 *
 * Retirado por decision de producto: era un AJUSTE compitiendo con las dos
 * acciones reales del panel (dictar y escanear), y solo tiene sentido con red y
 * en Chrome o Edge. La logica se conserva entera y se enciende poniendo esto en
 * `true`.
 */
const MOSTRAR_DICTADO_SEGUIDO: boolean = false;

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
    /*
     * El interruptor de dictado seguido se retiro de la interfaz.
     *
     * El estado y toda su logica se conservan — el dictado seguido sigue
     * funcionando si algo lo activa — pero YA NO se lee de `localStorage`: sin
     * control visible, un dispositivo que lo hubiera encendido antes se
     * quedaria en modo seguido para siempre y sin forma de apagarlo.
     */
    if (!MOSTRAR_DICTADO_SEGUIDO) return;
    setContinuo(localStorage.getItem('dictadoContinuo') === '1');
  }, []);
  const modoContinuo = useRef(false);
  modoContinuo.current = continuo;
  /** Lo pone el usuario al soltar/cancelar: corta la cadena de reinicios. */
  const detenidoAMano = useRef(false);
  /** Errores seguidos; con varios se apaga solo para no entrar en bucle. */
  const fallosSeguidos = useRef(0);
  const [dictados, setDictados] = useState(0);
  /*
   * Si el navegador no reconoce voz, el dictado continuo no puede hacer nada.
   * Se calcula una vez en el cliente porque `vozDisponible()` mira el objeto
   * global del navegador y en el servidor no existe.
   */
  const [hayVoz, setHayVoz] = useState(true);
  useEffect(() => setHayVoz(vozDisponible()), []);

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
    <main
      className="alto-pantalla mx-auto flex max-w-2xl flex-col overflow-hidden"
      /*
       * Que panel esta abierto. En pantalla corta la lista se oculta, y el
       * umbral depende del panel porque conteo mide 469 px y merma 739. La
       * regla vive en globals.css (`MODO ENFOQUE`): es una consulta de ALTO de
       * pantalla, y eso no se puede expresar con clases de utilidad.
       */
      data-panel={!activo ? 'lista' : tipo === 'MERMA' ? 'merma' : 'conteo'}
    >
      {/* ── Cabecera: progreso y estado de red ── */}
      {/* Filete de marca, igual que en el hero de entrada: da presencia
          constante al amarillo sin gastar la señal de alerta, que se reserva
          para los rellenos grandes (merma y el dialogo de anomalias). */}
      <header className="shrink-0 bg-acento px-3 pb-3 pt-2 text-white">
      <div className="flex items-center justify-between gap-2">
        {/* Salida explícita. Antes el nombre de la bodega era el único modo de
            volver, y no se veía como un botón: tocaba usar el "atrás" del
            navegador. */}
        <button
          onClick={() => router.push('/')}
          aria-label="Salir de esta bodega"
          className="toque flex shrink-0 items-center rounded-xl border border-white/30 px-3 text-lg transition-colors active:bg-white/15"
        >
          ←
        </button>
        {/*
          El nombre es TEXTO, no un boton.
          Habia dos controles llamando a `router.push('/')`: el ← de 56 px y el
          nombre de 224. El ← se añadio porque el nombre no se veia como boton,
          pero no se quito el nombre — y dos controles distintos que hacen lo
          mismo hacen suponer que hacen cosas distintas.
        */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{bodega}</p>
          <p className="truncate text-xs text-sobre-azul">{usuario?.nombre}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Se distingue "sin red" de "el servidor no responde": para el
              contador el efecto es el mismo (sigue contando), pero para quien
              soporta el punto de venta no lo es en absoluto. */}
          {/*
            En verde no se dice nada.
            "En línea" era ruido permanente: informaba de que todo va bien, que
            es el estado por defecto y no requiere ninguna accion. El aviso solo
            aparece cuando hay algo que saber — sin red, servidor caido, o
            capturas todavia sin enviar — y entonces en amarillo, porque
            entonces SI importa.
          */}
          {(!enLinea || porEnviar > 0) && (
          <span
            className="rounded-full bg-alerta px-3 py-1 text-xs font-semibold text-texto"
            title={
              conexion === 'SERVIDOR_INALCANZABLE'
                ? 'Hay red, pero el servidor no responde. Lo capturado se guarda y se envía solo cuando vuelva.'
                : conexion === 'SIN_RED'
                  ? 'Sin conexión. Lo capturado se guarda en la tablet y se envía solo al recuperar señal.'
                  : 'Todo sincronizado con el servidor.'
            }
          >
            {conexion === 'SIN_RED'
              ? 'Sin red'
              : conexion === 'SERVIDOR_INALCANZABLE'
                ? 'Servidor no responde'
                : 'Sincronizando'}
            {porEnviar > 0 && ` · ${porEnviar} por enviar`}
          </span>
          )}
          {usuario?.rol === 'LIDER' && (
            <button
              onClick={() => router.push(`/lider/${conteoId}`)}
              className="toque-menor rounded-full border border-white/40 px-3 text-xs font-semibold transition-colors active:bg-white/15"
            >
              Cierre
            </button>
          )}
        </div>
      </div>

        {/*
          El progreso pasa a ser un DATO, no una linea de 6 px.
          Era una barra fina bajo la cabecera y un "31/56" en texto de 12 px
          perdido junto al nombre de la persona. En una tarea de 56 repeticiones,
          cuanto llevas es lo mas motivador que hay y lo primero que se mira al
          levantar la vista: aqui va grande, con el porcentaje y la barra
          amarilla de marca a ancho completo.
        */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-2xl font-bold leading-none tabular-nums">
              {contados}
              <span className="text-base font-medium text-sobre-azul"> / {total}</span>
              <span className="ml-2 text-sm font-normal text-sobre-azul">artículos</span>
            </p>
            <p className="text-sm font-semibold tabular-nums text-alerta">
              {total ? Math.round((contados / total) * 100) : 0}%
            </p>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-valuenow={contados}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Artículos contados"
          >
            <div
              className="h-full rounded-full bg-alerta transition-all"
              style={{ width: `${total ? (contados / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      {/* ── Lista de articulos (sin cantidades del sistema) ── */}
      {/* min-h-0 es obligatorio: sin el, un hijo flex se niega a encogerse por
          debajo de su contenido y empuja la zona de captura fuera del marco. */}
      <section className="lista-articulos min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {familias.map((f) => (
            <button
              key={f}
              onClick={() => setFamilia(f)}
              className={`toque-menor shrink-0 rounded-full border px-4 text-sm transition-colors ${
                familia === f
                  ? 'border-acento bg-acento/15 font-medium text-acento'
                  : 'border-borde-fuerte text-tenue'
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
          className="toque mb-3 w-full rounded-xl border border-borde-fuerte bg-superficie px-4 text-base outline-none focus:border-acento focus:ring-2 focus:ring-acento/30"
        />

        {/*
          `grid-cols-1` no es decorativo: sin el, la pista implicita del grid se
          dimensiona a `max-content`. Como `truncate` implica
          `white-space: nowrap`, el nombre mas largo del catalogo estiraba la
          columna a 418 px dentro de un contenedor de 358 — el `truncate` no
          llegaba a actuar nunca y la columna derecha, la de la cantidad ya
          contada, quedaba 44 px fuera de la pantalla del telefono.
          `grid-cols-1` la fija en `minmax(0, 1fr)` y ahi si recorta.
        */}
        <ul className="grid grid-cols-1 gap-2 pb-4">
          {visibles.slice(0, 120).map((a) => {
            const contado = contadosPorArticulo.get(a.id);
            const esActivo = activo?.id === a.id;
            /*
             * Estado por FRANJA de color, no por un numero diminuto.
             *
             * Antes contado y pendiente se distinguian por un `12` frente a un
             * `—` a la derecha, con el mismo borde y casi el mismo fondo: en una
             * lista de 56 filas no se ve de un golpe cuanto queda. La franja de
             * 4 px se lee sin leer, que es lo que hace falta recorriendo un
             * estante.
             *
             * `ajeno` no es decoracion: significa que otra persona ya conto ese
             * articulo y la captura quedara en conflicto para que el lider
             * decida. Avisarlo ANTES de teclear ahorra el recuento.
             */
            const ajeno =
              contado !== undefined &&
              capturas.some(
                (c) => c.articuloId === a.id && c.usuarioNombre !== usuario?.nombre,
              );
            const franja = esActivo
              ? 'before:bg-acento'
              : ajeno
                ? 'before:bg-alerta'
                : contado !== undefined
                  ? 'before:bg-[var(--teal)]'
                  : 'before:bg-borde';
            return (
              <li key={a.id}>
                <button
                  onClick={() => elegirArticulo(a)}
                  aria-current={esActivo || undefined}
                  className={`toque relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl bg-superficie py-3 pl-5 pr-4 text-left shadow-sm transition-shadow before:absolute before:inset-y-0 before:left-0 before:w-[5px] active:shadow-none ${franja} ${
                    esActivo ? 'ring-2 ring-acento' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">
                      {a.nombre.trim()}
                    </span>
                    <span className="text-xs text-tenue">
                      {ajeno ? 'contado por otra persona' : ETIQUETA_UNIDAD[a.unidad as Unidad].plural}
                    </span>
                  </span>
                  {/* La cantidad en ficha, no en texto suelto: es el dato que se
                      busca al repasar lo ya contado. */}
                  {contado !== undefined ? (
                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
                        ajeno
                          ? 'bg-alerta/25 text-alerta-texto'
                          : 'bg-[var(--teal)]/15 text-[var(--teal)]'
                      }`}
                    >
                      {contado.toLocaleString('es-CO')}
                    </span>
                  ) : (
                    <span aria-hidden className="shrink-0 text-lg text-tenue">
                      →
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Zona de captura, siempre en la mitad inferior ── */}
      <section className="zona-captura margen-inferior-seguro shrink-0 border-t border-borde bg-superficie/70 px-4 pt-3 backdrop-blur">
        {avisoVoz && (
          <p className="mb-2 rounded-lg bg-alerta/15 px-3 py-2 text-sm text-alerta-texto">{avisoVoz}</p>
        )}

        {candidatos.length > 0 && (
          <div className="mb-3">
            <p className="mb-2 text-sm text-tenue">¿Cuál de estos es?</p>
            <div className="grid grid-cols-2 gap-2">
              {candidatos.slice(0, 4).map((c) => (
                <button
                  key={c.articulo.id}
                  onClick={() => elegirArticulo(c.articulo as ArticuloLocal, c.score)}
                  className="rounded-xl border border-borde-fuerte bg-superficie p-3 text-left text-sm transition-colors active:border-acento active:bg-acento/10"
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
            {/*
              La cantidad ocupa el espacio que libera la lista, como el visor de
              una calculadora.
              Al separar elegir de capturar quedaban ~660 px vacios sobre el
              teclado, y la cantidad seguia siendo un numero pequeño en una
              esquina. Pero "¿tecle mal el numero?" es LA pregunta de este
              producto — el 9 que se vuelve 90 — asi que ese hueco es
              exactamente donde debe verse, grande y sin competencia.
            */}
            <div className="pantalla-cantidad mb-3">
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
              <p className="cifra tabular-nums font-bold text-acento">
                {cantidad || '0'}
                <span className="ml-2 text-base font-normal text-tenue">
                  {ETIQUETA_UNIDAD[activo.unidad as Unidad].corta}
                </span>
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
                      className={`toque-menor rounded-full border px-4 text-sm transition-colors ${
                        motivoMerma === m
                          ? 'border-alerta-texto bg-alerta/25 font-medium text-alerta-texto'
                          : 'border-borde-fuerte text-tenue'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Colsubsidio no aclaró si el producto dañado se retira antes
                    del conteo. En vez de imponer una regla, se pregunta: con
                    eso el reporte calcula bien el descuadre. */}
                {/*
                  La fila entera es el objetivo tactil, no solo la casilla de
                  20 px: con guantes de bodega acertarle a un cuadro de 20 px es
                  una loteria, y aqui una equivocacion descuadra el reporte
                  (define si la merma se resta del conteo o no).
                */}
                <label className="toque-menor mb-3 -mx-1 flex cursor-pointer items-center gap-3 rounded-xl px-1 text-sm active:bg-alerta/10">
                  <input
                    type="checkbox"
                    checked={incluidoEnConteo}
                    onChange={(e) => setIncluidoEnConteo(e.target.checked)}
                    className="h-6 w-6 shrink-0 rounded accent-alerta"
                  />
                  <span className="text-tenue">
                    Este producto <strong className="text-texto">ya lo conté</strong> como
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
                      className="toque-menor rounded-lg border border-borde-fuerte px-3 text-xs"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => entradaFoto.current?.click()}
                    className="toque w-full rounded-xl border border-borde-fuerte text-sm transition-colors active:bg-superficie-alta"
                  >
                    Tomar foto de evidencia (opcional)
                  </button>
                )}
                {errorFoto && <p className="mt-2 text-xs text-peligro">{errorFoto}</p>}
              </div>
            )}

            {/*
              Los digitos y las ACCIONES dejan de pesar lo mismo.
              Eran doce bloques identicos: el 7 y el borrar se veian igual, y en
              una tarea de cientos de pulsaciones eso hace fallar. Ahora los
              digitos son la superficie elevada de siempre y C, borrar, coma y +½
              van en un tono aparte con texto atenuado: se distinguen sin leerlos.
            */}
            <div className="mb-2 grid grid-cols-4 gap-2">
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
              <span aria-hidden className="col-span-2" />
            </div>

            {/*
              Guardar como BARRA completa al borde inferior.
              Estaba dentro de la cuadricula ocupando dos celdas, o sea con el
              mismo peso visual que dos teclas mas. Es la accion que cierra el
              ciclo y se pulsa una vez por articulo: merece el ancho entero y el
              sitio mas alcanzable de la pantalla.
             
              El color del texto depende del relleno, y no es cosmetico: sobre el
              amarillo de marca va OSCURO (10.56:1) — en blanco daria 1.47:1,
              ilegible. Sobre el azul, blanco.
            */}
            <button
              onClick={intentarGuardar}
              disabled={cantidad === '' || (tipo === 'MERMA' && !motivoMerma)}
              className={`w-full rounded-xl text-lg font-bold tracking-wide shadow-sm transition-opacity disabled:opacity-40 ${
                tipo === 'MERMA' ? 'bg-alerta text-texto' : 'bg-acento text-white'
              }`}
              style={{ minHeight: 64 }}
            >
              {tipo === 'MERMA' ? 'Registrar baja' : 'Guardar'}
            </button>

            {/*
              Merma como accion SECUNDARIA, no como interruptor permanente.
              Estaba arriba y siempre visible: 48 px y dos controles en cada
              captura para lo que es la excepcion, no la norma — y ademas
              aparecia con la lista, cuando todavia no hay articulo al que dar
              de baja. Aqui esta donde se necesita (ya elegiste el articulo) y
              cuesta un control en vez de dos.
            */}
            <div className="mt-1 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const nuevo: TipoCaptura = tipo === 'MERMA' ? 'CONTEO' : 'MERMA';
                  setTipo(nuevo);
                  if (nuevo === 'CONTEO') limpiarMerma();
                }}
                className={`toque-menor rounded-xl px-3 text-sm font-medium transition-colors ${
                  tipo === 'MERMA'
                    ? 'bg-alerta/20 text-alerta-texto'
                    : 'text-tenue active:bg-superficie-alta'
                }`}
              >
                {tipo === 'MERMA' ? '← Volver a contar' : 'Registrar merma'}
              </button>
              <button
                onClick={() => {
                  setActivo(null);
                  setCantidad('');
                  limpiarMerma();
                  setTipo('CONTEO');
                }}
                // Es la UNICA vuelta a la lista: no puede medir 36 px de alto.
                className="toque-menor rounded-xl px-3 text-sm text-tenue transition-colors active:bg-superficie-alta"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          /*
           * Dos filas, no una.
           *
           * Estaban los cuatro controles y la pista en una sola fila. Entre el
           * microfono (104 px), "Escanear" y la casilla de continuo, a la pista
           * le quedaban 67 px medidos en un telefono de 390: "Dicta, e…". El
           * texto que explica como se usa la pantalla era justo el que no se
           * podia leer. Ahora la pista tiene el ancho completo y los controles
           * van debajo.
           */
          <div className="flex flex-col gap-3">
            <div className="min-h-[2.5rem]">
              {escuchando ? (
                <p className="text-sm font-medium text-acento">
                  {parcial ? <span className="text-texto">{parcial}…</span> : 'Escuchando… habla ahora'}
                </p>
              ) : parcial ? (
                <p className="text-sm text-texto">{parcial}…</p>
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
                  {/*
                    Aqui NO va nada mas.
                    Se retiraron la leyenda "Dicta, escanea o toca" y el atajo al
                    siguiente sin contar; poner en su lugar otra frase que diga
                    "elige, dicta o escanea" seria reponer el mismo ruido con
                    otras palabras. Los tres caminos ya estan a la vista: la
                    lista arriba, y Escanear y el microfono abajo.

                    El alto reservado se mantiene para que la confirmacion de lo
                    guardado aparezca sin desplazar el teclado.
                  */}
                </>
              )}
            </div>

            {/*
              El microfono manda; `continuo` es una OPCION suya.
              Antes eran tres botones hermanos del mismo rango: el interruptor
              de dictado continuo, Escanear y el microfono. Pero continuo no es
              una accion, es un ajuste — y ajuste DEL microfono: sin voz no hace
              nada. Ponerlo al mismo nivel hacia que compitiera con las dos
              acciones de verdad.
            */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEscaneando(true)}
                className="toque flex-1 rounded-xl border border-borde-fuerte bg-superficie px-4 text-sm font-semibold shadow-sm transition-colors active:border-acento active:bg-acento/10"
                title="Escanear código o QR de estante"
              >
                Escanear
              </button>

              {/*
                `seguido` AL LADO del microfono, no debajo.
                Apilado, la columna del microfono (104 px mas el interruptor)
                superaba en altura a "Escanear" y el panel crecia 30 px. Al lado,
                la fila mide lo que mide el microfono, y el interruptor sigue
                leyendose como suyo por tamaño y proximidad.
              */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="microfono bg-acento text-white shadow-sm disabled:opacity-40"
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

                {/*
                  Solo si este navegador reconoce voz. Antes se mostraba igual
                  cuando no habia soporte, o sea un control que no podia hacer
                  nada. Con el microfono al lado y debajo de el, se lee como lo
                  que es: como se comporta el microfono, no una tercera accion.
                */}
              </div>
            </div>
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
    // `tenue` ya no es solo un color de texto: cambia el MATERIAL de la tecla
    // (sin elevacion, superficie hundida) para que accion y digito no pesen
    // igual. Ver `.tecla-accion` en globals.css.
    <button onClick={onClick} className={`tecla ${tenue ? 'tecla-accion' : ''}`}>
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

  /*
   * Usa `Hoja` en vez de repetir el modal.
   *
   * Antes era una copia del mismo contenedor, y por eso se quedaba fuera de las
   * mejoras del componente: con el dialogo abierto seguian 36 controles vivos
   * detras — el teclado numerico entero. `Hoja` aisla lo de atras con `inert`.
   *
   * Sin `onCerrar` A PROPOSITO: aqui hay que elegir entre volver a teclear,
   * corregir o declarar un motivo. Descartar el aviso tocando fuera seria una
   * salida silenciosa de la verificacion que este producto existe para forzar.
   */
  return (
    <Hoja tono="alerta" titulo={principal.titulo}>
      <>
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
              className="toque rounded-xl bg-acento text-base font-semibold text-white"
            >
              Volver a teclear
            </button>

            {correcciones.map((o) => (
              <button
                key={o.etiqueta}
                onClick={() => onCorregir(o.valor!)}
                className="toque rounded-xl border border-borde-fuerte text-base font-medium transition-colors active:bg-superficie-alta"
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
                      className={`toque-menor rounded-full border px-4 text-sm transition-colors ${
                        motivo === m
                          ? 'border-acento bg-acento/15 font-medium text-acento'
                          : 'border-borde-fuerte text-tenue'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  onClick={onAceptar}
                  disabled={!motivo}
                  className="toque rounded-xl border border-borde-fuerte text-base transition-colors active:bg-superficie-alta disabled:opacity-40"
                >
                  Es correcto, guardar
                </button>
              </>
            )}
        </div>
      </>
    </Hoja>
  );
}

function Pantalla({ children }: { children: React.ReactNode }) {
  // `alto-pantalla` y no `h-screen`: en movil `100vh` cuenta con la barra de
  // direcciones colapsada, asi que centra respecto a una pantalla mas alta que
  // la real y el contenido queda por debajo del centro visible.
  return <main className="alto-pantalla flex items-center justify-center px-6">{children}</main>;
}
