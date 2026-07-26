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

interface CodigoDetectado {
  rawValue: string;
  /** Rectángulo del código dentro del fotograma, en píxeles del video. */
  boundingBox?: { x: number; y: number; width: number; height: number };
}

interface DetectorCodigos {
  detect(fuente: CanvasImageSource): Promise<CodigoDetectado[]>;
}

/** Lado del recuadro de puntería, en píxeles de pantalla. Debe coincidir con el CSS. */
const LADO_RECUADRO = 224;

/**
 * ¿El código cayó DENTRO del recuadro?
 *
 * Sin esto, `detect()` devuelve todos los códigos del fotograma y se tomaba el
 * primero — que suele ser el de más arriba, no al que apuntas. En un estante
 * con varias etiquetas juntas eso significa contar el artículo equivocado.
 *
 * El video se pinta con `object-cover`, así que hay que rehacer esa
 * transformación para pasar de coordenadas del video a coordenadas de pantalla.
 */
function dentroDelRecuadro(
  caja: { x: number; y: number; width: number; height: number } | undefined,
  video: HTMLVideoElement,
): boolean {
  // Sin caja no se puede filtrar: se acepta, es mejor que no leer nada.
  if (!caja) return true;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = video.clientWidth;
  const ch = video.clientHeight;
  if (!vw || !vh || !cw || !ch) return true;

  // `object-cover`: se escala al mayor de los dos factores y se recorta.
  const escala = Math.max(cw / vw, ch / vh);
  const desplazamientoX = (cw - vw * escala) / 2;
  const desplazamientoY = (ch - vh * escala) / 2;

  const centroX = (caja.x + caja.width / 2) * escala + desplazamientoX;
  const centroY = (caja.y + caja.height / 2) * escala + desplazamientoY;

  const lado = Math.min(LADO_RECUADRO, cw, ch);
  const izquierda = (cw - lado) / 2;
  const arriba = (ch - lado) / 2;

  // Un poco de holgura: apuntar con el pulso no es exacto.
  const holgura = lado * 0.15;
  return (
    centroX >= izquierda - holgura &&
    centroX <= izquierda + lado + holgura &&
    centroY >= arriba - holgura &&
    centroY <= arriba + lado + holgura
  );
}

export function EscanerCodigo({
  codigos,
  articulos,
  onArticulo,
  onCapturaRapida,
  onCerrar,
}: {
  codigos: Map<string, string>;
  articulos: ArticuloLocal[];
  /** Recibe el artículo y el código con el que se resolvió, para trazabilidad. */
  onArticulo: (a: ArticuloLocal, codigo: string) => void;
  /**
   * Guarda una captura SIN salir del escáner. Es lo que hace posible el modo
   * automático: recorrer un estante encadenando lecturas.
   *
   * Devuelve `true` si se guardó. Si devuelve `false` es porque saltó una
   * anomalía que hay que resolver fuera, y el escáner se cierra.
   */
  onCapturaRapida?: (a: ArticuloLocal, cantidad: number, codigo: string) => Promise<boolean>;
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
  /** true cuando se está usando el lector en JavaScript (iPhone/iPad). */
  const [usandoRespaldo, setUsandoRespaldo] = useState(false);

  /**
   * Modo automático: al reconocer un código lo toma sin pedir confirmación.
   *
   * Sirve para recorrer un estante escaneando uno tras otro. Va apagado por
   * defecto porque un escaneo equivocado entra sin que nadie lo vea, que es
   * justo lo que este producto existe para evitar — pero con las etiquetas de
   * estante bien puestas el riesgo baja mucho y la velocidad importa.
   *
   * La preferencia se recuerda entre sesiones.
   */
  const [automatico, setAutomatico] = useState(false);
  useEffect(() => {
    setAutomatico(localStorage.getItem('escaneoAutomatico') === '1');
  }, []);
  function cambiarAutomatico(valor: boolean) {
    setAutomatico(valor);
    localStorage.setItem('escaneoAutomatico', valor ? '1' : '0');
  }
  const auto = useRef(false);
  auto.current = automatico;

  /** Cantidad que se teclea sin salir de la cámara, en modo automático. */
  const [cantidad, setCantidad] = useState('');
  const [guardando, setGuardando] = useState(false);
  /** Lo capturado en esta sesión de escaneo, para ver el avance. */
  const [capturados, setCapturados] = useState<{ nombre: string; cantidad: number }[]>([]);

  async function guardarYSeguir() {
    if (!porConfirmar || !onCapturaRapida) return;
    const valor = Number(cantidad.replace(',', '.'));
    if (!Number.isFinite(valor)) return;

    setGuardando(true);
    const guardado = await onCapturaRapida(porConfirmar.articulo, valor, porConfirmar.codigo);
    setGuardando(false);

    if (!guardado) return; // saltó una anomalía: el padre cierra y la resuelve
    setCapturados((c) => [
      { nombre: porConfirmar.articulo.nombre.trim(), cantidad: valor },
      ...c,
    ]);
    // Vuelve a escanear sin cerrar la cámara.
    setPorConfirmar(null);
    setCantidad('');
    setUltimo(null);
  }

  /**
   * El catálogo se guarda en referencias para que el efecto de la cámara NO
   * dependa de ellas. `articulos` y `onArticulo` llegan como valores nuevos en
   * cada render del padre; si el efecto dependiera de ellos, la cámara se
   * apagaría y se volvería a pedir permiso en cada render.
   */
  const datos = useRef({ codigos, articulos });
  datos.current = { codigos, articulos };

  /** Igual con el callback: llega nuevo en cada render del padre. */
  const alElegir = useRef(onArticulo);
  alElegir.current = onArticulo;

  /** Se detiene la búsqueda mientras hay algo esperando validación. */
  const pausado = useRef(false);
  pausado.current = porConfirmar !== null;

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let animacion = 0;
    let cancelado = false;
    let detenerZxing: (() => void) | null = null;

    /** Un código leído, venga del lector que venga. */
    const alLeer = (valor: string) => {
      if (cancelado || pausado.current) return;
      const articulo = resolver(valor, datos.current.codigos, datos.current.articulos);
      if (!articulo) {
        setUltimo(valor);
        return;
      }
      if (navigator.vibrate) navigator.vibrate(60);

      // En modo automático la cámara NO se cierra: se pide solo la cantidad
      // y se vuelve a escanear. En modo normal se pide confirmar el artículo.
      setPorConfirmar({ articulo, codigo: valor });
      if (auto.current) setCantidad('');
    };

    (async () => {
      const Ctor = (window as unknown as Record<string, unknown>).BarcodeDetector as
        | (new (o: { formats: string[] }) => DetectorCodigos)
        | undefined;

      // ── Camino 2: navegadores sin BarcodeDetector ──────────────────────
      // Es el caso de TODO iPhone y iPad: en iOS los navegadores usan WebKit,
      // así que ni Safari ni Chrome traen esa API. Antes se cortaba aquí y la
      // cámara ni siquiera se abría. Se usa un lector en JavaScript, cargado
      // solo en ese caso para no engordar el paquete de quien no lo necesita.
      if (!Ctor) {
        try {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (cancelado || !video.current) return;

          const lector = new BrowserMultiFormatReader();
          const control = await lector.decodeFromVideoDevice(
            undefined, // la cámara que el navegador elija (trasera en móvil)
            video.current,
            (resultado) => {
              if (resultado) alLeer(resultado.getText());
            },
          );
          detenerZxing = () => control.stop();
          setUsandoRespaldo(true);
        } catch {
          setError(
            'No se pudo abrir la cámara. Revisa los permisos, o usa la voz y la búsqueda por nombre.',
          );
        }
        return;
      }

      // ── Camino 1: BarcodeDetector nativo (Chrome/Android) ──────────────
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
          // Solo los que caen en el recuadro: en un estante con varias
          // etiquetas juntas, tomar el primero de la lista significa contar
          // el artículo de al lado.
          const enMira = hallados.filter((h) => dentroDelRecuadro(h.boundingBox, video.current!));
          for (const h of enMira) {
            alLeer(h.rawValue);
            if (resolver(h.rawValue, datos.current.codigos, datos.current.articulos)) return;
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
      detenerZxing?.();
      flujo?.getTracks().forEach((t) => t.stop());
      // El lector de respaldo abre su propio flujo: se apaga también aquí por
      // si acaso, para no dejar la cámara encendida al salir.
      const s = video.current?.srcObject as MediaStream | null;
      s?.getTracks?.().forEach((t) => t.stop());
    };
    // Sin dependencias: la cámara se abre una vez y se cierra al desmontar.
    // Los datos que cambian se leen por referencia (ver `datos` arriba).
  }, []);

  return (
    <div className="alto-pantalla fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 text-sm text-tenue">
          Apunta al código dentro del recuadro
          {usandoRespaldo && (
            <span className="block text-xs">lector compatible · puede tardar un poco más</span>
          )}
        </p>
        <button
          onClick={onCerrar}
          className="toque shrink-0 rounded-xl border border-borde px-5 text-sm font-medium"
        >
          Salir
        </button>
      </div>

      {/* Modo automático: escanear uno tras otro sin confirmar cada uno. */}
      <label className="flex shrink-0 items-center justify-between gap-3 border-b border-borde/50 px-4 pb-3">
        <span className="text-sm">
          Escaneo automático
          <span className="block text-xs text-tenue">
            {automatico
              ? 'toma el artículo sin preguntar — más rápido, sin red de seguridad'
              : 'pide confirmar cada código antes de contarlo'}
          </span>
        </span>
        <input
          type="checkbox"
          checked={automatico}
          onChange={(e) => cambiarAutomatico(e.target.checked)}
          className="h-7 w-12 shrink-0 accent-acento"
        />
      </label>

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

        {/* Avance de la sesión de escaneo, sin tener que salir a mirar. */}
        {capturados.length > 0 && (
          <div className="absolute left-4 top-4 max-w-[60%] rounded-xl bg-black/70 px-3 py-2 backdrop-blur">
            <p className="text-xs font-medium text-acento">
              {capturados.length} capturado{capturados.length === 1 ? '' : 's'}
            </p>
            <p className="truncate text-xs text-white/80">
              último: {capturados[0].nombre} · {capturados[0].cantidad.toLocaleString('es-CO')}
            </p>
          </div>
        )}
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

          {automatico && onCapturaRapida ? (
            // ── Modo automático: se teclea la cantidad aquí mismo y se
            //    sigue escaneando. La cámara nunca se cierra.
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-tenue">¿Cuántos?</span>
                <span className="text-3xl font-bold tabular-nums text-acento">
                  {cantidad || '0'}
                </span>
              </div>
              <div className="mb-2 grid grid-cols-4 gap-2">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setCantidad(cantidad + d)}
                    className="tecla"
                    style={{ minHeight: 52 }}
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={() => setCantidad(cantidad.slice(0, -1))}
                  className="tecla text-tenue"
                  style={{ minHeight: 52 }}
                >
                  ⌫
                </button>
                <button
                  onClick={() => setCantidad(cantidad + '0')}
                  className="tecla"
                  style={{ minHeight: 52 }}
                >
                  0
                </button>
                <button
                  onClick={() =>
                    setCantidad(cantidad.includes(',') ? cantidad : (cantidad || '0') + ',')
                  }
                  className="tecla text-tenue"
                  style={{ minHeight: 52 }}
                >
                  ,
                </button>
                <button
                  onClick={guardarYSeguir}
                  disabled={cantidad === '' || guardando}
                  className="col-span-2 rounded-xl bg-acento text-base font-semibold text-white disabled:opacity-40"
                  style={{ minHeight: 52 }}
                >
                  {guardando ? '…' : 'Guardar y seguir'}
                </button>
              </div>
              <button
                onClick={() => {
                  setPorConfirmar(null);
                  setCantidad('');
                  setUltimo(null);
                }}
                className="w-full py-2 text-sm text-tenue"
              >
                Omitir · escanear otro
              </button>
            </>
          ) : (
            <div className="grid gap-2">
              <button
                onClick={() => onArticulo(porConfirmar.articulo, porConfirmar.codigo)}
                className="toque rounded-xl bg-acento text-base font-semibold text-white"
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
          )}
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
