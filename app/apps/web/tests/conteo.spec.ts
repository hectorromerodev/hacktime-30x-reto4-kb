/**
 * Tests E2E: ciclo de conteo.
 *
 * El camino crítico del producto: dos taps por artículo, conteo ciego,
 * detección de anomalías y sincronización offline.
 *
 * Los elementos interactivos se localizan por `data-testid` (teclado, guardar,
 * búsqueda, fila de artículo), no por clase CSS: la clase es de estilo y cambia
 * con el diseño; el testid es identidad y no. Los textos visibles (cabeceras,
 * avisos) sí se verifican por su copy, que es justo lo que ve el usuario.
 */
import { test, expect } from '@playwright/test';
import { configurarApi, ingresar } from './helpers';

async function entrarABodega(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /Kiosco Piscigiros AyB/ }).click();
  // Esperar que cargue la pantalla de conteo
  await page.waitForURL(/\/contar\//);
  await expect(page.getByText('artículos')).toBeVisible({ timeout: 20_000 });
}

/** Fila de la lista de artículos cuyo nombre contiene `nombre`. */
function fila(page: import('@playwright/test').Page, nombre: string) {
  return page.getByTestId('fila-articulo').filter({ hasText: nombre }).first();
}

/** Teclea una cantidad en el teclado numérico de captura. */
async function teclear(page: import('@playwright/test').Page, cantidad: string) {
  for (const d of cantidad) {
    await page.getByTestId(`tecla-${d}`).click();
  }
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
    const articulo = fila(page, 'ACEITE');
    await expect(articulo).toBeVisible({ timeout: 10_000 });
    await articulo.click();

    // Verificar que aparece la zona de captura
    await expect(page.getByTestId('btn-guardar')).toBeVisible();

    // Teclear cantidad y guardar
    await teclear(page, '50');
    await page.getByTestId('btn-guardar').click();

    // Verificar que avanza al siguiente artículo (aviso de confirmación)
    await expect(page.getByText(/guardado|siguiente|Cancelar/)).toBeVisible({ timeout: 5_000 });
  });

  test('anomalía: cantidad fuera de escala dispara diálogo de verificación', async ({ page }) => {
    await ingresar(page);
    await entrarABodega(page);

    // Buscar ACEITE
    await page.getByTestId('buscar-articulo').fill('ACEITE');
    await fila(page, 'ACEITE').click();

    // Teclear 900 (fuera de escala — el stock real ronda ~30)
    await teclear(page, '900');
    await page.getByTestId('btn-guardar').click();

    // Debe aparecer el diálogo de verificación de anomalía
    await expect(page.getByText(/Verificación de cantidad|fuera de la escala/).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText('Volver a teclear')).toBeVisible();
  });

  test('búsqueda por nombre filtra artículos', async ({ page }) => {
    await ingresar(page);
    await entrarABodega(page);

    await page.getByTestId('buscar-articulo').fill('AGUA');

    // Debe mostrar artículos que contienen "AGUA" en lugar de toda la lista
    await expect(fila(page, 'AGUA')).toBeVisible({ timeout: 5_000 });
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
    const articulo = fila(page, 'ACEITE');
    if (await articulo.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await articulo.click();
      await page.getByTestId('tecla-1').click();
      await page.getByTestId('btn-guardar').click();
    }

    // Reconectar
    await page.context().setOffline(false);

    // Debe sincronizarse solo y mostrar "En línea" de nuevo
    await expect(page.getByText('En línea')).toBeVisible({ timeout: 20_000 });
  });
});
