/**
 * Service worker escrito a mano.
 *
 * A proposito no se usa next-pwa ni serwist: en una ventana de horas, pelear
 * con la configuracion de un plugin cuesta mas que las ~60 lineas que hacen
 * falta. Lo unico que se necesita es que la app ARRANQUE con la tablet en modo
 * avion; los datos ya viven en IndexedDB.
 *
 * Estrategia:
 *  - navegaciones y assets: red primero, cache como respaldo (para que un
 *    despliegue nuevo no quede congelado en la tablet);
 *  - la API NUNCA se cachea: devolver un catalogo viejo o, peor, una respuesta
 *    de sincronizacion vieja, corromperia el conteo.
 */

const CACHE = 'conteo-v1';
const ESENCIALES = ['/', '/manifest.json', '/icono.svg'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ESENCIALES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // La API se deja pasar sin tocar: la capa offline es IndexedDB, no el cache.
  if (url.pathname.startsWith('/api/')) return;

  evento.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(async () => {
        const enCache = await caches.match(req);
        if (enCache) return enCache;
        // Navegacion sin cache exacto: se sirve la raiz para que arranque la app.
        if (req.mode === 'navigate') {
          const raiz = await caches.match('/');
          if (raiz) return raiz;
        }
        return new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' });
      }),
  );
});
