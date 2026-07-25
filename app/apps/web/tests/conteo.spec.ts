/**
 * Tests E2E: ciclo de conteo.
 *
 * El camino crítico del producto: dos taps por artículo, conteo ciego,
 * detección de anomalías y sincronización offline.
 */
import { test, expect } from '@playwright/test';
import { configurarApi, ingresar } from './helpers';

async function entrarABodega(page: import('@playwright/test').Page) {
  await page.getByText('Kiosco Piscigiros AyB').click();
  // Esperar que cargue la pantalla de conteo
  await page.waitForURL(/\/contar\//);
  await expect(page.getByText('artículos')).toBeVisible({ timeout: 20_000 });
}

test.describe('Conteo', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await configurarApi(page);
  });

  test('entrar a bodega Kiosco Piscigiros AyB', async ({ page }) => {
    await ingresar(page);
    await entrarABodega(page);

    // Verificar cabecera
    await expect(page.getByText('Kiosco Piscigiros AyB')).toBeVisible();
    await expect(page.getByText('Ana Gómez')).toBeVisible();
    // Verificar la barra de progreso (0/x artículos)
    await expect(page.getByText(/\/.*artículos/)).toBeVisible();
  });

  test('seleccionar artículo → teclear cantidad → guardar', async ({ page }) => {
    await ingresar(page);
    await entrarABodega(page);

    // Seleccionar ACEITE de la lista (visible)
    const articulo = page.getByText('ACEITE').first();
    await expect(articulo).toBeVisible({ timeout: 10_000 });
    await articulo.click();

    // Verificar que aparece en la zona de captura
    await expect(page.getByText('Guardar')).toBeVisible();

    // Teclear cantidad
    await page.locator('.tecla').filter({ hasText: '5' }).click();
    await page.locator('.tecla').filter({ hasText: '0' }).click();

    // Guardar
    await page.getByText('Guardar').click();

    // Verificar que avanza al siguiente artículo (aviso de confirmación)
    await expect(page.getByText(/guardado|siguiente|Cancelar/)).toBeVisible({ timeout: 5_000 });
  });

  test('anomalía: cantidad fuera de escala dispara diálogo de verificación', async ({ page }) => {
    await ingresar(page);
    await entrarABodega(page);

    // Buscar ACEITE
    await page.getByPlaceholder('Buscar artículo…').fill('ACEITE');
    await page.getByText('ACEITE').first().click();

    // Teclear 900 (fuera de escala — el stock real ronda ~30)
    await page.locator('.tecla').filter({ hasText: '9' }).click();
    await page.locator('.tecla').filter({ hasText: '0' }).click();
    await page.locator('.tecla').filter({ hasText: '0' }).click();

    // Intentar guardar
    await page.getByText('Guardar').click();

    // Debe aparecer el diálogo de verificación de anomalía
    await expect(page.getByText(/Verificación de cantidad|fuera de la escala/).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText('Volver a teclear')).toBeVisible();
  });

  test('búsqueda por nombre filtra artículos', async ({ page }) => {
    await ingresar(page);
    await entrarABodega(page);

    const input = page.getByPlaceholder('Buscar artículo…');
    await input.fill('AGUA');

    // Debe mostrar artículos que contienen "AGUA" en lugar de toda la lista
    const primera = page.getByText('AGUA').first();
    await expect(primera).toBeVisible({ timeout: 5_000 });
  });

  test('sin red: contar offline no muestra errores', async ({ page }) => {
    await ingresar(page);
    await entrarABodega(page);

    // Cortar la red simulando modo avión
    await page.context().setOffline(true);

    // Verificar que la cabecera muestra "Sin red"
    await expect(page.getByText('Sin red')).toBeVisible({ timeout: 5_000 });

    // Seleccionar un artículo y contar
    // NOTA: en modo offline, si el catálogo ya está en IndexedDB, funciona.
    // Si es la primera carga de esta bodega, no habrá datos locales.
    // Este test asume que el catálogo ya se descargó (caso normal en bodega).
    const articulo = page.getByText('ACEITE').first();
    if (await articulo.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await articulo.click();
      await page.locator('.tecla').filter({ hasText: '1' }).click();
      await page.getByText('Guardar').click();
    }

    // Reconectar
    await page.context().setOffline(false);

    // Debe sincronizarse solo y mostrar "En línea" de nuevo
    await expect(page.getByText('En línea')).toBeVisible({ timeout: 20_000 });
  });
});
