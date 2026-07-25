'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker. Solo funciona en contexto seguro (HTTPS o
 * localhost), que es la misma condicion que exigen el microfono y la camara —
 * por eso Caddy emite HTTPS incluso en local.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app sigue funcionando mientras la pestaña esté
      // abierta: IndexedDB no depende de él. Solo se pierde el arranque en frío
      // sin red, así que no vale la pena molestar al contador con un error.
    });
  }, []);

  return null;
}
