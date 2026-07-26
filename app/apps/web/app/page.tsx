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

type Paso = 'cargando' | 'usuario' | 'pin' | 'bodega';

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

  async function abrirConteo(bodega: Bodega) {
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
        <p className="text-white/70">Cargando…</p>
      </Marco>
    );
  }

  if (paso === 'usuario') {
    return (
      <Marco>
        <Titulo>¿Quién va a contar?</Titulo>
        {error && <Aviso>{error}</Aviso>}
        <Lista>
          {usuarios.map((u) => (
            <Fila
              key={u.id}
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
        <p className="text-sm text-white/70">Hola, {elegido?.nombre}</p>
        <Titulo>Ingresa tu PIN</Titulo>

        <div className="mb-5 flex justify-center gap-3" aria-label={`${pin.length} de 4 dígitos`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              /* Amarillo de marca al llenarse. Dentro del azul si se lee
                 (5.97:1), que es lo que no puede hacer sobre fondo claro. */
              className={`h-3 w-3 rounded-full transition-colors ${
                pin.length > i ? 'scale-125 bg-alerta' : 'bg-white/30'
              }`}
            />
          ))}
        </div>

        {error && <Aviso>{error}</Aviso>}

        <div className="mt-auto grid grid-cols-3 gap-2 pb-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="tecla" onClick={() => enviarPin(pin + d)}>
              {d}
            </button>
          ))}
          <button
            className="tecla text-base"
            onClick={() => {
              setPaso('usuario');
              setPin('');
            }}
          >
            Atrás
          </button>
          <button className="tecla" onClick={() => enviarPin(pin + '0')}>
            0
          </button>
          <button className="tecla text-base" onClick={() => setPin(pin.slice(0, -1))}>
            ⌫
          </button>
        </div>
      </Marco>
    );
  }

  const conInventario = bodegas.filter((b) => b.tieneInventario);
  const sinInventario = bodegas.filter((b) => !b.tieneInventario);

  return (
    <Marco>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white"
          >
            {iniciales(yo?.nombre ?? '')}
          </span>
          <span className="min-w-0 truncate text-sm text-white/70">
            {yo?.nombre} · {yo?.rol === 'LIDER' ? 'líder de costos' : 'contador'}
          </span>
        </p>
        <button
          className="toque-menor shrink-0 rounded-xl px-3 text-sm text-white/80 underline transition-colors active:bg-white/10"
          onClick={async () => {
            await api('/auth/logout', { method: 'POST' });
            location.reload();
          }}
        >
          Salir
        </button>
      </div>

      <Titulo>Elige la bodega a contar</Titulo>
      {error && <Aviso>{error}</Aviso>}

      <Lista>
        {conInventario.map((b) => (
          <Fila
            key={b.id}
            onClick={() => abrirConteo(b)}
            desactivado={abriendo !== null}
            titulo={b.nombre}
            detalle={`${b.articulos} artículos en catálogo`}
            flecha={abriendo === b.id ? '…' : '→'}
          />
        ))}
      </Lista>

      {sinInventario.length > 0 && (
        <details className="mt-5 border-t border-white/15 pt-3">
          <summary className="toque-menor flex cursor-pointer items-center text-sm text-white/70">
            Otras {sinInventario.length} bodegas del parque (sin inventario en el archivo)
          </summary>
          {/*
            Se listan a proposito. El archivo de Colsubsidio nombra las bodegas
            del parque pero solo 8 traen hoja de stock; ocultarlas daria la
            impresion de que la solucion solo cubre una parte.
          */}
          <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-white/60">
            {sinInventario.map((b) => (
              <li key={b.id} className="truncate">
                · {b.nombre}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Marco>
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
    <main className="alto-pantalla flex flex-col overflow-hidden bg-superficie">
      <header className="shrink-0 px-5 pb-6 pt-10 text-center">
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
        `sobre-azul` cambia el aspecto de `.tecla` solo aqui: el teclado del PIN
        pasa a translucido con digitos blancos. En `contar`, que es claro, las
        teclas siguen igual.
      */}
      <section className="sobre-azul margen-inferior-seguro min-h-0 flex-1 overflow-y-auto rounded-t-3xl bg-acento px-5 pt-6 text-white">
        <div className="mx-auto flex min-h-full w-full flex-col" style={{ maxWidth: 520 }}>
          {children}
        </div>
      </section>
    </main>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-semibold">{children}</h2>;
}

/** Sin tarjetas: las filas se separan con una linea, no con cajas. */
function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-1">{children}</ul>;
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
}: {
  onClick: () => void;
  inicial?: string;
  titulo: string;
  detalle: string;
  flecha?: string;
  desactivado?: boolean;
  /** Resalta el detalle en amarillo. Solo para lo excepcional. */
  destacado?: boolean;
}) {
  return (
    <li className="border-b border-white/15 last:border-0">
      <button
        onClick={onClick}
        disabled={desactivado}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors active:bg-white/15 disabled:opacity-50"
        style={{ minHeight: 64 }}
      >
        {inicial && (
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold"
          >
            {inicial}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{titulo}</span>
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
              destacado ? 'font-semibold text-alerta' : 'text-white/60'
            }`}
          >
            {detalle}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-lg text-white/70">
          {flecha}
        </span>
      </button>
    </li>
  );
}

/**
 * Aviso de error DENTRO del panel azul.
 *
 * No puede ser texto rojo: #C0392B sobre #004B8D da 1.61:1, ilegible. Se
 * invierte a relleno rojo con texto blanco (5.44:1, AA).
 */
function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 rounded-xl bg-peligro px-4 py-3 text-sm font-medium text-white">
      {children}
    </p>
  );
}
