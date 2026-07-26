import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config para el frontend de conteo.
 *
 * La app se corre con Docker (docker compose up). Los tests asumen que
 * la API y el frontend están disponibles en https://localhost.
 *
 * Ejecutar:
 *   cd app/apps/web
 *   npx playwright test
 *
 * Requisito previo (una sola vez):
 *   npx playwright install chromium
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE ?? 'https://localhost';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true, // Caddy emite certificado local de desarrollo
    trace: 'on-first-retry',
    // Deja evidencia cuando un test cae: sin esto el artefacto de CI queda
    // vacío (reporter `list`, sin reintentos) y no hay nada que mirar.
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Pixel 5'] }, // Tablet pequeña ≈ lo más parecido al dispositivo real
    },
  ],
});
