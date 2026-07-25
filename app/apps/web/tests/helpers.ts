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
  // Orden importa: el último route registrado gana en Playwright.
  // La ruta comodín va primero, las específicas después.

  // Comodín: redirige el resto de /api al servicio real.
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    url.host = 'api:4000';
    url.protocol = 'http';
    const response = await route.fetch({ url: url.toString() });
    await route.fulfill({ response });
  });

  // Mock de /auth/yo: siempre "no autenticado" al inicio.
  await page.route('**/api/auth/yo', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  });

  // Mock de /usuarios: devuelve la lista esperada sin tocar la red.
  await page.route('**/api/usuarios', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        usuarios: [
          { id: '1', nombre: 'Ana Gómez', rol: 'CONTADOR' },
          { id: '2', nombre: 'Luis Ramírez', rol: 'CONTADOR' },
          { id: '3', nombre: 'Sandra Peña', rol: 'CONTADOR' },
          { id: '4', nombre: 'Bibiana Torres', rol: 'LIDER' },
        ],
      }),
    });
  });

  // Mock de /auth/login: PIN 1111 para Ana, 2222 para Luis, etc.
  const pines: Record<string, string> = {
    '1': '1111', '2': '2222', '3': '3333', '4': '9999',
  };
  await page.route('**/api/auth/login', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    const id = body.usuarioId;
    const pinEsperado = pines[id] ?? '9999';
    if (body.pin === pinEsperado) {
      const rol = id === '4' ? 'LIDER' : 'CONTADOR';
      const nombre = ['Ana Gómez', 'Luis Ramírez', 'Sandra Peña', 'Bibiana Torres'][Number(id) - 1];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          usuario: { usuarioId: id, nombre, rol },
        }),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'PIN incorrecto.' }),
      });
    }
  });
}

/**
 * Ingresa como Ana Gómez y llega a la pantalla de bodegas.
 * Asume que `configurarApi` ya fue llamado.
 */
export async function ingresar(page: Page) {
  await page.goto('/');
  await page.getByText('Ana Gómez').click();
  for (const d of PIN_ANA) {
    await page.locator('.tecla').filter({ hasText: d }).click();
  }
}
