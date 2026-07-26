'use client';

/**
 * Ingreso + eleccion de bodega.
 *
 * El ingreso es a proposito minimo: seleccionar el nombre de una lista y teclear
 * un PIN de 4 digitos. La tablet es un dispositivo compartido de bodega, y lo
 * unico que la auditoria exige es poder atribuir cada captura a una persona.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Bodega, type Usuario } from '@/lib/api';
import { db, guardarMeta } from '@/lib/db';
import { agruparBodegas } from '@/lib/bodegas';
import { Hoja } from '@/components/ui/Hoja';
import { Boton } from '@/components/ui/Boton';

type Paso = 'cargando' | 'usuario' | 'pin' | 'bodega';

/**
 * ¿Se listan las bodegas del parque que NO traen hoja de stock?
 *
 * Estaban visibles a proposito: el archivo de Colsubsidio nombra las bodegas
 * del parque pero solo 8 traen stock, y mostrarlas evitaba dar la impresion de
 * que la solucion cubre solo una parte. `PLAN_HACKATHON.md` lo recoge como
 * limitacion declarada, y el README lo usa como argumento.
 *
 * Se apagan por decision de producto: 46 nombres que no se pueden tocar debajo
 * de las 8 que si, en una pantalla de telefono, pesan mas de lo que aclaran.
 *
 * El bloque se conserva entero y se enciende poniendo esto en `true`. Va como
 * constante y no comentando el JSX para que el bloque siga compilando y no se
 * podrezca: codigo comentado deja de tipar el dia que cambia `Bodega`.
 */
const MOSTRAR_BODEGAS_SIN_INVENTARIO: boolean = false;

export default function Inicio() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>('cargando');
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; rol: string }[]>([]);
  const [elegido, setElegido] = useState<{ id: string; nombre: string } | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [yo, setYo] = useState<Usuario | null>(null);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { usuario } = await api<{ usuario: Usuario }>('/auth/yo');
        setYo(usuario);
        await cargarBodegas();
        setPaso('bodega');
      } catch {
        try {
          const r = await api<{ usuarios: typeof usuarios }>('/usuarios');
          setUsuarios(r.usuarios);
          setPaso('usuario');
        } catch {
          setError('No se pudo contactar el servidor.');
          setPaso('usuario');
        }
      }
    })();
  }, []);

  async function cargarBodegas() {
    const r = await api<{ bodegas: Bodega[] }>('/bodegas');
    setBodegas(r.bodegas);
  }

  async function enviarPin(nuevo: string) {
    setPin(nuevo);
    if (nuevo.length < 4 || !elegido) return;

    try {
      const r = await api<{ usuario: Usuario }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usuarioId: elegido.id, pin: nuevo }),
      });
      setYo(r.usuario);
      await guardarMeta('usuario', r.usuario);
      await cargarBodegas();
      setPaso('bodega');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PIN incorrecto.');
      setPin('');
    }
  }

  async function abrirConteo(bodega: { id: string }) {
    setAbriendo(bodega.id);
    try {
      const r = await api<{ conteo: { id: string } }>('/conteos', {
        method: 'POST',
        body: JSON.stringify({ bodegaId: bodega.id }),
      });
      // Un cambio de bodega invalida el catalogo local: son articulos distintos.
      const previo = await db.meta.get('conteoId');
      if (previo?.valor !== r.conteo.id) await db.articulos.clear();
      await guardarMeta('conteoId', r.conteo.id);
      router.push(`/contar/${r.conteo.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el conteo.');
      setAbriendo(null);
    }
  }

  if (paso === 'cargando') {
    return (
      <Marco>
        <p className="text-tenue">Cargando…</p>
      </Marco>
    );
  }

  if (paso === 'usuario') {
    return (
      <Marco>
        <Titulo>¿Quién va a contar?</Titulo>
        {error && <Aviso>{error}</Aviso>}
        <Lista tono="claro">
          {usuarios.map((u) => (
            <Fila
              key={u.id}
              tono="claro"
              onClick={() => {
                setElegido(u);
                setPin('');
                setError(null);
                setPaso('pin');
              }}
              inicial={iniciales(u.nombre)}
              titulo={u.nombre}
              detalle={u.rol === 'LIDER' ? 'líder de costos' : 'contador'}
              destacado={u.rol === 'LIDER'}
            />
          ))}
        </Lista>
      </Marco>
    );
  }

  if (paso === 'pin') {
    return (
      <Marco>
        {/*
          Quien eres es lo primero y lo mas grande de la pantalla.
          Antes "Hola, Ana Gómez" iba en texto pequeño y atenuado y el titular
          era "Ingresa tu PIN" — pero que hay que teclear el PIN ya lo dice el
          teclado. Lo que de verdad hay que poder comprobar de un vistazo, antes
          de teclear nada, es que se eligio a la persona correcta. Con la
          inicial repetida de la pantalla anterior, un usuario equivocado se
          nota sin leer.
        */}
        <div className="text-center">
          <span
            aria-hidden
            className="avatar-pin mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-acento/10 text-lg font-bold text-acento"
          >
            {iniciales(elegido?.nombre ?? '')}
          </span>
          <p className="mt-3 text-sm text-tenue">Hola,</p>
          <p className="text-2xl font-bold leading-tight">{elegido?.nombre}</p>
          <p className="mt-3 text-sm text-tenue">Ingresa tu PIN</p>
        </div>

        <div
          className="puntos-pin mb-5 mt-4 flex justify-center gap-3"
          aria-label={`${pin.length} de 4 dígitos`}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              /* Azul de marca al llenarse: sobre el fondo hueso el amarillo no
                 se leeria (1.47:1), el azul si (8.12:1). El vacio va en borde
                 fuerte para que el hueco tambien se vea. */
              className={`h-3 w-3 rounded-full transition-colors ${
                pin.length > i ? 'scale-125 bg-acento' : 'bg-borde-fuerte'
              }`}
            />
          ))}
        </div>

        {error && <Aviso>{error}</Aviso>}

        <div className="mt-auto grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              className="tecla"
              data-testid={`tecla-${d}`}
              onClick={() => enviarPin(pin + d)}
            >
              {d}
            </button>
          ))}
          {/*
            Hueco a la izquierda del cero, como en el teclado del telefono.
            Antes esa celda era "Atrás": una accion de navegacion mezclada entre
            los digitos, del mismo tamaño y peso que un 7. Ahi se pulsa por
            error y, peor, no se encuentra cuando se busca. Ahora vive abajo
            como accion secundaria propia.
          */}
          <span aria-hidden />
          <button
            className="tecla"
            data-testid="tecla-0"
            onClick={() => enviarPin(pin + '0')}
          >
            0
          </button>
          <button
            className="tecla text-base"
            onClick={() => setPin(pin.slice(0, -1))}
            aria-label="Borrar el último dígito"
          >
            ⌫
          </button>
        </div>

        {/*
          Salida secundaria: si el PIN es correcto se pasa solo, asi que este
          boton solo hace falta cuando se eligio a la persona equivocada. Por eso
          es plano y no compite con el teclado, pero ocupa el ancho completo y
          los 56 px de `.toque`: es una salida, no un adorno.
        */}
        <button
          onClick={() => {
            setPaso('usuario');
            setPin('');
            setError(null);
          }}
          className="toque mt-2 w-full rounded-xl text-base font-medium text-tenue underline decoration-borde underline-offset-4 transition-colors active:bg-superficie-alta"
        >
          Regresar
        </button>
      </Marco>
    );
  }

  const conInventario = bodegas.filter((b) => b.tieneInventario);
  const sinInventario = bodegas.filter((b) => !b.tieneInventario);
  const grupos = agruparBodegas(conInventario, filtro);

  return (
    <MarcoTrabajo
      usuario={yo}
      onCerrarSesion={() => setConfirmandoSalida(true)}
      confirmando={confirmandoSalida}
      onCancelar={() => setConfirmandoSalida(false)}
    >
      <Titulo>Elige la bodega a contar</Titulo>

      {/*
        Buscador fijo. Con ocho bodegas no es imprescindible, pero el archivo
        de Colsubsidio nombra 54 y el dia que lleguen sus hojas de stock esta
        pantalla no habra que rehacerla. Se queda pegado arriba al desplazar:
        si hay que desplazar para ver una bodega, tambien hay que poder filtrar
        sin volver al principio.
      */}
      {/* Se queda pegado arriba al desplazar, sobre el fondo hueso para que las
          tarjetas no se cuelen por detras del buscador. */}
      <div className="sticky top-0 z-10 mb-4 bg-fondo pb-2 pt-1">
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar bodega…"
          aria-label="Buscar bodega"
          className="toque w-full rounded-xl border border-borde-fuerte bg-superficie px-4 text-base text-texto placeholder:text-tenue outline-none focus:border-acento focus:ring-2 focus:ring-acento/30"
        />
      </div>

      {error && <Aviso>{error}</Aviso>}

      {grupos.length === 0 ? (
        <p className="rounded-xl border border-borde bg-superficie px-4 py-6 text-center text-sm text-tenue">
          Ninguna bodega coincide con «{filtro}».
        </p>
      ) : (
        grupos.map((g) => (
          <section key={g.sitio} className="mb-5">
            {/*
              El sitio como agrupador, no como parte de cada nombre. Los ocho
              nombres reales son "sitio + resto + tipo" sin excepcion, asi que
              agrupar por sitio deja la pantalla organizada como el recorrido
              de la persona: se va A un sitio, y alli hay una o dos bodegas.
            */}
            <h3 className="mb-2 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-tenue">
              {g.sitio}
              <span className="font-normal text-tenue">· {g.bodegas.length}</span>
            </h3>
            <Lista tono="claro">
              {g.bodegas.map((b) => (
                <Fila
                  key={b.id}
                  tono="claro"
                  onClick={() => abrirConteo(b)}
                  desactivado={abriendo !== null}
                  titulo={b.titulo}
                  distintivo={b.distintivo}
                  detalle={`${b.articulos.toLocaleString('es-CO')} artículos`}
                  flecha={abriendo === b.id ? '…' : '→'}
                />
              ))}
            </Lista>
          </section>
        ))
      )}

      {MOSTRAR_BODEGAS_SIN_INVENTARIO && sinInventario.length > 0 && (
        <details className="mt-5 border-t border-borde pt-3">
          <summary className="toque-menor flex cursor-pointer items-center text-sm text-tenue">
            Otras {sinInventario.length} bodegas del parque (sin inventario en el archivo)
          </summary>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-tenue">
            {sinInventario.map((b) => (
              <li key={b.id} className="truncate">
                · {b.nombre}
              </li>
            ))}
          </ul>
        </details>
      )}
    </MarcoTrabajo>
  );
}

/** "Ana Gómez" -> "AG". Ancla visual para elegir sin leer. */
function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Claro arriba, azul abajo.
 *
 * Invertido respecto a la version anterior por dos razones que se refuerzan:
 *
 *  - El logo oficial es el de color (wordmark azul, simbolo amarillo, fondo
 *    transparente). Sobre claro se muestra COMPLETO y en sus colores exactos,
 *    sin la placa blanca que hacia falta para que no desapareciera sobre azul.
 *  - Deja la zona interactiva abajo, que es el principio que ya rige el resto
 *    de la aplicacion: lo que se pulsa vive en la mitad inferior, al alcance
 *    del pulgar.
 *
 * El panel azul se desplaza por dentro (`overflow-y-auto`) porque el paso de
 * bodegas tiene 8 tarjetas mas un desplegable de 46 nombres: una banda de alto
 * fijo no podria contenerlo.
 */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="alto-pantalla mx-auto flex max-w-5xl flex-col overflow-hidden bg-fondo">
      <header className="marca-entrada shrink-0 px-5 pb-6 pt-10 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Logo.webp"
          alt="Colsubsidio"
          width={997}
          height={357}
          className="mx-auto h-14 w-auto sm:h-16"
        />
        <h1 className="mt-5 text-xl font-semibold">Conteo de inventarios</h1>
        <p className="text-sm text-tenue">Piscilago</p>
        <div className="mx-auto mt-4 h-[3px] w-16 rounded-full bg-alerta" />
      </header>

      {/*
        Panel sobre el fondo hueso, igual que el resto de la app. `panel-entrada`
        no aporta color: solo ancla la regla que encoge las teclas del PIN en
        pantallas cortas (iPhone SE). El teclado usa `.tecla` por defecto —
        tarjeta blanca con digito oscuro, el mismo que la pantalla de captura.
      */}
      <section className="panel-entrada margen-inferior-seguro min-h-0 flex-1 overflow-y-auto px-5 pt-6 text-texto">
        <div className="flex min-h-full w-full flex-col">{children}</div>
      </section>
    </main>
  );
}

/**
 * Marco del paso de bodegas: barra de sesion en vez del hero con logo.
 *
 * Aqui el logo no aporta y cuesta caro. Medido en la version anterior: el hero
 * ocupaba 207 px en un telefono de 844 — un 25% de la pantalla — mientras solo
 * 4 de las 8 bodegas quedaban visibles sin desplazar, y en un iPhone SE, 3. El
 * logo ya cumplio su trabajo en el ingreso; repetirlo en la pantalla siguiente
 * no dice nada nuevo y empuja el contenido bajo el pliegue.
 *
 * La barra de 56 px conserva la marca por el color y el filete amarillo, y usa
 * ese espacio para lo que aqui SI hace falta: quien esta dentro y como salir.
 */
function MarcoTrabajo({
  children,
  usuario,
  onCerrarSesion,
  confirmando,
  onCancelar,
}: {
  children: React.ReactNode;
  usuario: Usuario | null;
  onCerrarSesion: () => void;
  confirmando: boolean;
  onCancelar: () => void;
}) {
  async function cerrarSesion() {
    await api('/auth/logout', { method: 'POST' });
    location.reload();
  }

  return (
    <main className="alto-pantalla mx-auto flex max-w-5xl flex-col overflow-hidden bg-fondo text-texto">
      <header className="flex shrink-0 items-center gap-3 border-b-[3px] border-b-alerta bg-acento px-4 py-2 text-white">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold"
        >
          {iniciales(usuario?.nombre ?? '')}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium">{usuario?.nombre}</span>
          <span className="block truncate text-xs text-sobre-azul">
            {usuario?.rol === 'LIDER' ? 'líder de costos' : 'contador'}
          </span>
        </span>
        {/*
          Etiqueta explicita, no "Salir". Y con confirmacion: antes cerraba la
          sesion en el acto, asi que un toque en falso obligaba a volver a
          elegir usuario y teclear el PIN. En un dispositivo compartido de
          bodega ese roce se paga varias veces al dia.
        */}
        <button
          onClick={onCerrarSesion}
          className="toque-menor shrink-0 rounded-xl border border-white/30 px-3 text-xs font-medium transition-colors active:bg-white/15"
        >
          Cerrar sesión
        </button>
      </header>

      <section className="margen-inferior-seguro min-h-0 flex-1 overflow-y-auto px-5 pt-4">
        <div className="w-full">{children}</div>
      </section>

      {confirmando && (
        <Hoja titulo={`¿Cerrar la sesión de ${usuario?.nombre}?`} onCerrar={onCancelar}>
          <p className="mb-4 text-sm text-tenue">
            Tendrás que elegir tu usuario y teclear el PIN otra vez. Lo que ya contaste queda
            guardado.
          </p>
          <div className="grid gap-2">
            <Boton variante="peligro" ancho onClick={cerrarSesion}>
              Cerrar sesión
            </Boton>
            {/* Cancelar de segundo: la accion segura no debe ser la que cae
                bajo el pulgar por defecto en un dialogo destructivo. */}
            <Boton variante="contorno" ancho onClick={onCancelar}>
              Cancelar
            </Boton>
          </div>
        </Hoja>
      )}
    </main>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-semibold">{children}</h2>;
}

/**
 * Lista de filas.
 *
 * `azul` (por defecto): sobre el panel azul de entrada, las filas se separan
 * con una linea, no con cajas. `claro`: sobre el fondo hueso (bodegas), cada
 * fila es una tarjeta blanca con aire entre ellas, igual que la pantalla de
 * conteo y la del lider.
 */
function Lista({
  children,
  tono = 'azul',
}: {
  children: React.ReactNode;
  tono?: 'azul' | 'claro';
}) {
  return <ul className={`grid grid-cols-1 ${tono === 'claro' ? 'gap-2' : ''}`}>{children}</ul>;
}

/**
 * Fila sin caja.
 *
 * Al quitar el contorno, el limite de lo pulsable deja de ser evidente — con
 * guantes eso importa. Se compensa por dos vias: 64 px de alto (por encima del
 * minimo de 44) y un realce al pulsar que ocupa la fila entera, asi que el
 * toque se confirma aunque no haya borde que lo anuncie.
 */
function Fila({
  onClick,
  inicial,
  titulo,
  detalle,
  flecha = '→',
  desactivado,
  destacado,
  distintivo,
  tono = 'azul',
}: {
  onClick: () => void;
  inicial?: string;
  titulo: string;
  detalle: string;
  flecha?: string;
  desactivado?: boolean;
  /** Resalta el detalle en amarillo. Solo para lo excepcional. */
  destacado?: boolean;
  /** Etiqueta corta junto al titulo: el tipo de bodega. */
  distintivo?: string | null;
  /**
   * `azul` (por defecto): fila sin caja sobre el panel azul de entrada; el
   * limite lo dan 64 px de alto y el realce al pulsar. `claro`: tarjeta blanca
   * sobre el fondo hueso, con borde y sombra propios, como el resto de la app.
   */
  tono?: 'azul' | 'claro';
}) {
  const claro = tono === 'claro';
  return (
    <li className={claro ? '' : 'border-b border-white/15 last:border-0'}>
      <button
        onClick={onClick}
        disabled={desactivado}
        className={`flex w-full items-center gap-3 rounded-xl py-3 text-left transition-colors disabled:opacity-50 ${
          claro
            ? 'border border-borde bg-superficie px-4 shadow-sm active:border-acento active:bg-acento/10'
            : 'px-2 active:bg-white/15'
        }`}
        style={{ minHeight: 64 }}
      >
        {inicial && (
          <span
            aria-hidden
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              claro ? 'bg-acento/10 text-acento' : 'bg-white/15'
            }`}
          >
            {inicial}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{titulo}</span>
            {/*
              El tipo (AyB / Suministros) como etiqueta y no dentro del nombre:
              es lo que distingue dos bodegas del MISMO sitio, asi que conviene
              que se lea de un golpe y no al final de una frase larga.

              Sin `uppercase`: "AyB" es una sigla (alimentos y bebidas) y
              forzarla a mayusculas la escribe mal, "AYB".
            */}
            {distintivo && (
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                  claro ? 'bg-superficie-alta text-tenue' : 'bg-white/15 text-white'
                }`}
              >
                {distintivo}
              </span>
            )}
          </span>
          {/*
            El amarillo marca la EXCEPCION, no la regla.
            Puesto en cada detalle, "contador" repetido tres veces se volvia lo
            mas llamativo de la pantalla — jerarquia al reves, porque lo que
            distingue una fila de otra es el nombre. Reservado a lo que de
            verdad cambia algo (el rol de lider, que es el unico que ve el
            cierre y la exportacion), el color informa en vez de decorar.
          */}
          <span
            className={`block truncate text-xs ${
              destacado
                ? `font-semibold ${claro ? 'text-alerta-texto' : 'text-alerta'}`
                : claro
                  ? 'text-tenue'
                  : 'text-sobre-azul'
            }`}
          >
            {detalle}
          </span>
        </span>
        <span aria-hidden className={`shrink-0 text-lg ${claro ? 'text-tenue' : 'text-sobre-azul'}`}>
          {flecha}
        </span>
      </button>
    </li>
  );
}

/**
 * Aviso de error.
 *
 * Relleno rojo con texto blanco (5.44:1, AA): se lee igual sobre el hueso de
 * las pantallas de entrada que sobre cualquier otra superficie. No se usa texto
 * rojo suelto porque #C0392B cae por debajo del mínimo según el fondo.
 */
function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 rounded-xl bg-peligro px-4 py-3 text-sm font-medium text-white">
      {children}
    </p>
  );
}
