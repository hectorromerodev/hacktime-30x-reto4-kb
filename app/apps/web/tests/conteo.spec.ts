/**
 * Tests E2E: ciclo de conteo.
 *
 * El camino crítico del producto: dos taps por artículo, conteo ciego,
 * detección de anomalías y sincronización offline.
 */
import { test, expect } from '@playwright/test';
import { configurarApi, ingresar } from './helpers';

async function entrarABodega(page: import('@playwright/test').Page) {
  // En la lista la fila se llama solo "Piscigiros": el sitio ("KIOSCO") es el
  // agrupador. Dentro, la cabecera SI muestra el nombre completo, que es lo que
  // comprueba el test de mas abajo.
  await page.getByText('Piscigiros').click();
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

    /*
     * Se FILTRA antes de elegir.
     *
     * `getByText('ACEITE').first()` era ambiguo: el catalogo tiene ACEITE,
     * ACEITE DE OLIVA y ACEITE DE AJONJOLI, y los datos de demostracion dejan
     * dos de ellos ya contados. Segun cual cayera primero, guardar disparaba la
     * regla de duplicado, el dialogo bloqueaba el guardado y el test no probaba
     * lo que dice su nombre.
     */
    await page.getByPlaceholder('Buscar artículo…').fill('AGUA 280 ML');
    const articulo = page.getByText('AGUA 280 ML').first();
    await expect(articulo).toBeVisible({ timeout: 10_000 });
    await articulo.click();

    // Verificar que aparece en la zona de captura
    await expect(page.getByText('Guardar')).toBeVisible();

    /*
     * 30 unidades, y el articulo no es casual.
     *
     * AGUA 280 ML tiene 24 en stock, o sea su `exp10` esta en las DECENAS: 30
     * cae en el mismo orden de magnitud y no dispara ninguna regla. Con la
     * eleccion anterior el guardado quedaba bloqueado por el dialogo, y como la
     * asercion buscaba /guardado|siguiente|Cancelar/ — y "Cancelar" esta en
     * pantalla SIEMPRE que el panel de captura este abierto, dialogo incluido —
     * el test pasaba en falso sin comprobar nada.
     *
     * AGUA BOTELLA no sirve: tiene 423, y 30 seria un orden por debajo.
     */
    await page.getByTestId('tecla-3').click();
    await page.getByTestId('tecla-0').click();

    await page.getByRole('button', { name: 'Guardar' }).click();

    /*
     * Asercion fuerte: el guardado ocurrio de verdad.
     *
     * El E2E ahora corre contra el backend real (Caddy, sin interceptar
     * `/api/**`), asi que guardar SI se completa: el articulo se deselecciona,
     * el boton `Guardar` desaparece y la zona de captura muestra la
     * confirmacion "✓ AGUA 280 ML · 30 un". Se comprueban las dos cosas —el
     * panel cerrado y el dato guardado— en vez del texto ambiguo de antes, que
     * pasaba con el panel simplemente abierto.
     */
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeHidden({ timeout: 5_000 });
    await expect(page.getByText(/AGUA 280 ML · 30/)).toBeVisible();
  });

  test('anomalía: cantidad fuera de escala dispara diálogo de verificación', async ({ page }) => {
    await ingresar(page);
    await entrarABodega(page);

    // Buscar ACEITE
    await page.getByPlaceholder('Buscar artículo…').fill('ACEITE');
    await page.getByText('ACEITE').first().click();

    // Teclear 900 (fuera de escala — el stock real ronda ~30)
    await page.getByTestId('tecla-9').click();
    await page.getByTestId('tecla-0').click();
    await page.getByTestId('tecla-0').click();

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
      await page.getByTestId('tecla-1').click();
      await page.getByText('Guardar').click();
    }

    // Reconectar
    await page.context().setOffline(false);

    // El indicador "En línea" se retiro: en verde no se dice nada. Volver a la
    // normalidad se comprueba por la DESAPARICION del aviso, que es una
    // asercion mas fuerte — antes bastaba con que apareciera un texto, ahora
    // hay que demostrar que el estado de alarma se fue.
    await expect(page.getByText('Sin red')).toBeHidden({ timeout: 20_000 });
  });
});
