/**
 * Helpers compartidos para tests E2E.
 *
 * El stack corre con Caddy que emite HTTPS para `localhost` y rutea `/api/*`
 * al servicio API. Los tests se ejecutan en un contenedor Playwright conectado
 * a la misma red Docker, accediendo a `web:3000`. Como no hay Caddy en ese
 * camino, se interceptan las llamadas a `/api/*` y se redirigen al servicio
 * API directamente via `http://api:4000`.
 */
import { Page } from '@playwright/test';

/** PIN de Ana Gómez, contadora de demo. */
export const PIN_ANA = ['1', '1', '1', '1'];

/**
 * Configura el page para rutear llamadas a la API.
 * Debe llamarse antes de `page.goto('/')`.
 */
export async function configurarApi(page: Page) {
  // Dos formas de correr el E2E:
  //
  //  1. Contra Caddy por HTTPS (base https://…, el modo por defecto): Caddy ya
  //     enruta /api al servicio api y sirve la cookie Secure sin problema. No
  //     hace falta interceptar nada.
  //  2. Directo al contenedor web por HTTP (http://web:3000, sin Caddy): ahí sí
  //     hay que reenviar /api al api y quitarle el flag Secure a la cookie, que
  //     el navegador descartaría sobre http plano. Se activa con
  //     PLAYWRIGHT_DIRECT=1.
  if (process.env.PLAYWRIGHT_DIRECT !== '1') return;

  // Un solo interceptor: reenvía TODAS las llamadas /api/** al servicio API real,
  // que ya viene seedeado con los 4 usuarios demo, las 54 bodegas y el catálogo.
  // Nada se mockea — el login, la lista de bodegas y el conteo salen del backend
  // de verdad, que es justo lo que un E2E debe ejercitar.
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    url.host = 'api:4000';
    url.protocol = 'http';
    url.pathname = url.pathname.replace(/^\/api/, ''); // Caddy usa handle_path /api/*: strip del prefijo
    const response = await route.fetch({ url: url.toString() });

    // El backend marca la cookie de sesión como Secure (la imagen corre con
    // NODE_ENV=production). Sobre http://web:3000 el navegador descarta las
    // cookies Secure, así que la sesión no sobreviviría al login y todo lo
    // autenticado (bodegas, catálogo) daría 401. Quitamos el flag sólo dentro
    // del test para que el flujo real funcione sin HTTPS.
    const headers = response.headers();
    if (headers['set-cookie']) {
      headers['set-cookie'] = headers['set-cookie'].replace(/;\s*Secure/gi, '');
    }
    await route.fulfill({ response, headers });
  });
}

/**
 * Ingresa como Ana Gómez y llega a la pantalla de bodegas.
 * Asume que `configurarApi` ya fue llamado.
 */
export async function ingresar(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Ana Gómez/ }).click();
  for (const d of PIN_ANA) {
    await page.getByTestId(`tecla-${d}`).click();
  }
}
