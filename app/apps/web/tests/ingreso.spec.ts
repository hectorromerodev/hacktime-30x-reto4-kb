/**
 * Tests E2E: ingreso y selección de bodega.
 *
 * La ruta más corta posible al corazón del producto. Si esto falla,
 * nada más se puede probar.
 */
import { test, expect } from '@playwright/test';
import { configurarApi, ingresar, PIN_ANA } from './helpers';

test.describe('Ingreso', () => {
  test.beforeEach(async ({ page }) => {
    await configurarApi(page);
  });

  test('carga la pantalla de selección de usuario', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Conteo de inventarios')).toBeVisible();
    await expect(page.getByText('¿Quién va a contar?')).toBeVisible();
    await expect(page.getByText('Ana Gómez')).toBeVisible();
    await expect(page.getByText('Luis Ramírez')).toBeVisible();
  });

  test('flujo completo: seleccionar usuario → PIN → bodegas', async ({ page }) => {
    await ingresar(page);

    // Debe mostrar la pantalla de selección de bodega
    await expect(page.getByText('Elige la bodega a contar')).toBeVisible();
    await expect(page.getByText('Kiosco Piscigiros AyB')).toBeVisible();
    await expect(page.getByText('Ana Gómez')).toBeVisible();
  });

  test('PIN incorrecto muestra error', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Ana Gómez/ }).click();

    // PIN equivocado
    for (const d of ['2', '2', '2', '2']) {
      await page.getByTestId(`tecla-${d}`).click();
    }

    await expect(page.getByText('PIN incorrecto')).toBeVisible();
  });

  test('botón Atrás vuelve a selección de usuario', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Ana Gómez/ }).click();

    await page.getByRole('button', { name: 'Atrás' }).click();
    await expect(page.getByText('¿Quién va a contar?')).toBeVisible();
  });
});
