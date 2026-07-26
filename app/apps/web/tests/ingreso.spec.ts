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

    // Debe mostrar la pantalla de selección de bodega.
    //
    // La lista ya no imprime el nombre completo en una sola cadena: el sitio es
    // el agrupador ("KIOSCO") y la fila lleva el resto ("Piscigiros"), con el
    // tipo como distintivo. Se comprueban las dos partes, que juntas son la
    // bodega, en vez del texto plano de antes.
    await expect(page.getByText('Elige la bodega a contar')).toBeVisible();
    await expect(page.getByRole('heading', { name: /KIOSCO/i })).toBeVisible();
    await expect(page.getByText('Piscigiros')).toBeVisible();
    await expect(page.getByText('Ana Gómez')).toBeVisible();
  });

  test('PIN incorrecto muestra error', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Ana Gómez').click();

    // PIN equivocado
    for (const d of ['2', '2', '2', '2']) {
      await page.getByTestId(`tecla-${d}`).click();
    }

    await expect(page.getByText('PIN incorrecto')).toBeVisible();
  });

  // La salida dejo de ser una tecla ("Atrás", entre los digitos) y paso a ser
  // un boton secundario debajo del teclado. Mismo comportamiento; cambia solo
  // donde vive y como se llama.
  test('botón Regresar vuelve a selección de usuario', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Ana Gómez').click();

    await page.getByRole('button', { name: 'Regresar' }).click();
    await expect(page.getByText('¿Quién va a contar?')).toBeVisible();
  });
});
