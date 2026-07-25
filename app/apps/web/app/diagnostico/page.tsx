'use client';

/**
 * Diagnóstico del micrófono.
 *
 * Existe porque "la voz no funciona" puede significar seis cosas distintas y
 * el navegador solo reporta una palabra (`network`, `not-allowed`,
 * `no-speech`…). Esta página muestra el código crudo y todos los eventos en
 * orden, para no tener que adivinar desde otra máquina.
 *
 * No es parte del producto: es una herramienta de soporte. Se deja publicada
 * a propósito, porque el fallo aparece en el dispositivo del contador y no en
 * el del que programa.
 */

import { useEffect, useRef, useState } from 'react';

interface Entrada {
  hora: string;
  evento: string;
  detalle?: string;
}

export default function Diagnostico() {
  const [entorno, setEntorno] = useState<Record<string, string>>({});
  const [registro, setRegistro] = useState<Entrada[]>([]);
  const [escuchando, setEscuchando] = useState(false);
  const rec = useRef<any>(null);

  const anotar = (evento: string, detalle?: string) =>
    setRegistro((r) => [
      ...r,
      { hora: new Date().toISOString().slice(11, 23), evento, detalle },
    ]);

  useEffect(() => {
    const w = window as any;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setEntorno({
      navegador: navigator.userAgent,
      'contexto seguro': String(window.isSecureContext),
      protocolo: location.protocol,
      origen: location.origin,
      'SpeechRecognition (estándar)': typeof w.SpeechRecognition,
      'webkitSpeechRecognition': typeof w.webkitSpeechRecognition,
      'API de voz disponible': String(Boolean(Ctor)),
      'mediaDevices': typeof navigator.mediaDevices,
      'getUserMedia': typeof navigator.mediaDevices?.getUserMedia,
      'navigator.onLine': String(navigator.onLine),
      idioma: navigator.language,
    });

    // Estado del permiso, si el navegador lo expone.
    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((p) => setEntorno((e) => ({ ...e, 'permiso de micrófono': p.state })))
      .catch(() =>
        setEntorno((e) => ({ ...e, 'permiso de micrófono': 'no consultable' })),
      );
  }, []);

  async function probarMicrofono() {
    anotar('getUserMedia', 'pidiendo acceso al micrófono…');
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const pistas = flujo.getAudioTracks();
      anotar('getUserMedia OK', `pistas: ${pistas.map((t) => t.label || '(sin nombre)').join(', ')}`);
      flujo.getTracks().forEach((t) => t.stop());
    } catch (e) {
      const err = e as { name?: string; message?: string };
      anotar('getUserMedia FALLÓ', `${err.name}: ${err.message}`);
    }
  }

  function probarVoz() {
    const w = window as any;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      anotar('SIN API', 'este navegador no expone SpeechRecognition');
      return;
    }

    const r = new Ctor();
    rec.current = r;
    r.lang = 'es-CO';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 5;

    for (const ev of [
      'start', 'audiostart', 'soundstart', 'speechstart',
      'speechend', 'soundend', 'audioend', 'end', 'nomatch',
    ]) {
      r.addEventListener(ev, () => anotar(ev));
    }

    r.addEventListener('error', (e: any) => {
      // ESTE es el dato que hace falta: la palabra exacta que devuelve el
      // navegador. `network` señala a los servidores de reconocimiento;
      // `not-allowed`, al permiso; `no-speech`, a que no entró audio.
      anotar('❌ ERROR', `${e.error}${e.message ? ' — ' + e.message : ''}`);
    });

    r.addEventListener('result', (e: any) => {
      const ultimo = e.results[e.results.length - 1];
      const alternativas: string[] = [];
      for (let i = 0; i < ultimo.length; i++) alternativas.push(ultimo[i].transcript);
      anotar(
        ultimo.isFinal ? '✅ RESULTADO FINAL' : 'parcial',
        `${alternativas.length} hipótesis · ${alternativas.map((a) => `"${a}"`).join(' | ')}`,
      );
    });

    r.addEventListener('end', () => setEscuchando(false));

    try {
      r.start();
      setEscuchando(true);
      anotar('start() llamado', 'habla ahora');
    } catch (e) {
      anotar('start() lanzó excepción', String(e));
    }
  }

  function detener() {
    try {
      rec.current?.stop();
    } catch {
      /* ya estaba detenido */
    }
    setEscuchando(false);
  }

  const textoParaCopiar = [
    '--- ENTORNO ---',
    ...Object.entries(entorno).map(([k, v]) => `${k}: ${v}`),
    '',
    '--- EVENTOS ---',
    ...registro.map((e) => `${e.hora}  ${e.evento}${e.detalle ? '  ' + e.detalle : ''}`),
  ].join('\n');

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-6">
      <h1 className="text-2xl font-semibold">Diagnóstico del micrófono</h1>
      <p className="mb-6 text-sm text-tenue">
        Abre esta página en el navegador donde falla, pulsa los dos botones y comparte el
        resultado. El dato que importa es el código que aparece junto a ❌ ERROR.
      </p>

      <div className="tarjeta mb-5">
        <h2 className="mb-2 text-sm font-medium text-tenue">Entorno</h2>
        <dl className="grid gap-1 text-xs">
          {Object.entries(entorno).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="shrink-0 text-tenue">{k}:</dt>
              <dd className="break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <button onClick={probarMicrofono} className="toque rounded-xl border border-borde px-5">
          1 · Probar micrófono
        </button>
        {!escuchando ? (
          <button onClick={probarVoz} className="toque rounded-xl bg-acento px-5 font-semibold text-black">
            2 · Probar reconocimiento
          </button>
        ) : (
          <button onClick={detener} className="toque rounded-xl bg-alerta px-5 font-semibold text-black">
            Detener (estoy escuchando…)
          </button>
        )}
        <button
          onClick={() => setRegistro([])}
          className="toque rounded-xl border border-borde px-5 text-tenue"
        >
          Limpiar
        </button>
      </div>

      <div className="tarjeta mb-4">
        <h2 className="mb-2 text-sm font-medium text-tenue">Eventos, en orden</h2>
        {registro.length === 0 ? (
          <p className="text-sm text-tenue">Todavía nada. Pulsa los botones de arriba.</p>
        ) : (
          <ul className="grid gap-1 font-mono text-xs">
            {registro.map((e, i) => (
              <li key={i} className={e.evento.includes('ERROR') ? 'text-peligro' : ''}>
                <span className="text-tenue">{e.hora}</span> {e.evento}
                {e.detalle && <span className="text-tenue"> — {e.detalle}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => navigator.clipboard?.writeText(textoParaCopiar)}
        className="toque w-full rounded-xl border border-borde px-5 text-sm"
      >
        Copiar todo al portapapeles
      </button>

      <div className="tarjeta mt-6 text-sm">
        <h2 className="mb-2 font-medium">Qué significa cada error</h2>
        <ul className="grid gap-2 text-tenue">
          <li>
            <code className="text-white">network</code> — el navegador no pudo llegar a sus
            servidores de reconocimiento. Es el más común: firewall, VPN, red corporativa o
            bloqueo de servicios de Google.
          </li>
          <li>
            <code className="text-white">not-allowed</code> — falta el permiso de micrófono, o
            una política del navegador lo bloquea.
          </li>
          <li>
            <code className="text-white">no-speech</code> — no entró audio. El micrófono
            funciona, pero no captó voz.
          </li>
          <li>
            <code className="text-white">audio-capture</code> — no hay micrófono disponible.
          </li>
          <li>
            <code className="text-white">service-not-allowed</code> — el navegador tiene
            deshabilitado el servicio de dictado.
          </li>
        </ul>
      </div>
    </main>
  );
}
