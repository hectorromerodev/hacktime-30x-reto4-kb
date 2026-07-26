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
    return <Centro><p className="text-tenue">Cargando…</p></Centro>;
  }

  if (paso === 'usuario') {
    return (
      <Centro>
        <Encabezado />
        <h2 className="mb-4 text-lg text-tenue">¿Quién va a contar?</h2>
        {error && <Aviso>{error}</Aviso>}
        <div className="grid gap-3">
          {usuarios.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                setElegido(u);
                setPin('');
                setError(null);
                setPaso('pin');
              }}
              className="toque tarjeta flex items-center justify-between text-left active:border-acento"
            >
              <span className="text-xl font-medium">{u.nombre}</span>
              <span className="text-xs uppercase tracking-wide text-tenue">
                {u.rol === 'LIDER' ? 'líder de costos' : 'contador'}
              </span>
            </button>
          ))}
        </div>
      </Centro>
    );
  }

  if (paso === 'pin') {
    return (
      <Centro>
        <Encabezado />
        <p className="mb-1 text-tenue">Hola, {elegido?.nombre}</p>
        <h2 className="mb-5 text-lg">Ingresa tu PIN</h2>

        <div className="mb-6 flex gap-3" aria-label={`${pin.length} de 4 dígitos`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-14 w-14 rounded-xl border-2 ${
                pin.length > i ? 'border-acento bg-acento/20' : 'border-borde'
              }`}
            />
          ))}
        </div>

        {error && <Aviso>{error}</Aviso>}

        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              data-testid={`tecla-${d}`}
              className="tecla"
              onClick={() => enviarPin(pin + d)}
            >
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
          <button data-testid="tecla-0" className="tecla" onClick={() => enviarPin(pin + '0')}>
            0
          </button>
          <button className="tecla text-base" onClick={() => setPin(pin.slice(0, -1))}>
            ⌫
          </button>
        </div>
      </Centro>
    );
  }

  const conInventario = bodegas.filter((b) => b.tieneInventario);
  const sinInventario = bodegas.filter((b) => !b.tieneInventario);

  return (
    <Centro ancho>
      <Encabezado />
      <div className="mb-5 flex items-center justify-between">
        <p className="text-tenue">
          {yo?.nombre} · {yo?.rol === 'LIDER' ? 'líder de costos' : 'contador'}
        </p>
        <button
          className="text-sm text-tenue underline"
          onClick={async () => {
            await api('/auth/logout', { method: 'POST' });
            location.reload();
          }}
        >
          Salir
        </button>
      </div>

      <h2 className="mb-3 text-lg">Elige la bodega a contar</h2>
      {error && <Aviso>{error}</Aviso>}

      <div className="grid gap-3">
        {conInventario.map((b) => (
          <button
            key={b.id}
            disabled={abriendo !== null}
            onClick={() => abrirConteo(b)}
            className="toque tarjeta flex items-center justify-between text-left active:border-acento disabled:opacity-50"
          >
            <span>
              <span className="block text-xl font-medium">{b.nombre}</span>
              <span className="text-sm text-tenue">{b.articulos} artículos en catálogo</span>
            </span>
            <span className="text-2xl text-acento">
              {abriendo === b.id ? '…' : '→'}
            </span>
          </button>
        ))}
      </div>

      {sinInventario.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-tenue">
            Otras {sinInventario.length} bodegas del parque (sin inventario en el archivo)
          </summary>
          {/*
            Se listan a proposito. El archivo de Colsubsidio nombra 48 bodegas
            pero solo 8 traen hoja de stock; ocultarlas daria la impresion de
            que la solucion solo cubre una parte del parque.
          */}
          <ul className="mt-3 grid gap-1 text-sm text-tenue">
            {sinInventario.map((b) => (
              <li key={b.id}>· {b.nombre}</li>
            ))}
          </ul>
        </details>
      )}
    </Centro>
  );
}

function Centro({ children, ancho }: { children: React.ReactNode; ancho?: boolean }) {
  return (
    <main className="mx-auto flex min-h-screen w-full flex-col justify-center px-5 py-8"
      style={{ maxWidth: ancho ? 680 : 460 }}>
      {children}
    </main>
  );
}

function Encabezado() {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold">Conteo de inventarios</h1>
      <p className="text-sm text-tenue">Piscilago · Colsubsidio</p>
    </header>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 rounded-xl border border-peligro/50 bg-peligro/10 px-4 py-3 text-sm text-peligro">
      {children}
    </p>
  );
}
