// Graba los 4 beats del guion (concepto/guion-video.md) contra el stack real.
// Uso: BASE=https://localhost:9443 OUT=/ruta/clips FOTO=/ruta/evidencia.jpg \
//        node video-walkthrough.mjs
// Produce beat1.webm … beat4.webm + tiempos.json (offset donde "empieza la
// escena" de cada clip, para recortar la cabecera de login en el montaje).
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE ?? 'https://localhost:9443';
const OUT = process.env.OUT ?? './clips';
const FOTO = process.env.FOTO ?? './evidencia.jpg';
const iPad = devices['iPad (gen 7)']; // 810×1080: ≥640px para que el panel del líder muestre tablas

fs.mkdirSync(OUT, { recursive: true });
const rutaTiempos = path.join(OUT, 'tiempos.json');
const tiempos = fs.existsSync(rutaTiempos) ? JSON.parse(fs.readFileSync(rutaTiempos, 'utf8')) : {};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Onda visible en cada toque: sin cursor de mouse, el espectador necesita ver dónde se tocó.
const ONDA = `
  addEventListener('pointerdown', (e) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:' + (e.clientX - 24) + 'px;top:' + (e.clientY - 24) +
      'px;width:48px;height:48px;border-radius:50%;background:rgba(0,75,141,.35);' +
      'border:2px solid rgba(0,75,141,.6);pointer-events:none;z-index:2147483647;' +
      'transition:transform .45s ease-out,opacity .45s ease-out';
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = 'scale(1.9)'; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 500);
  }, true);
`;

async function nuevoClip(browser, nombre) {
  const context = await browser.newContext({
    ...iPad,
    ignoreHTTPSErrors: true,
    recordVideo: { dir: OUT, size: { width: 810, height: 1080 } },
  });
  await context.addInitScript(ONDA);
  context.setDefaultTimeout(20_000); // la librería pura no trae timeout: sin esto un selector roto cuelga para siempre
  const page = await context.newPage();
  const t0 = Date.now();
  const marca = (etiqueta) => {
    (tiempos[nombre] ??= {})[etiqueta] = Date.now() - t0;
    console.log(`  ${nombre} · ${etiqueta} @ ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  };
  const cerrar = async () => {
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(OUT, `${nombre}.webm`));
    await video.delete();
  };
  return { context, page, marca, cerrar };
}

async function ingresar(page, nombre, teclaPin) {
  await page.goto(BASE + '/');
  await page.getByRole('button', { name: new RegExp(nombre) }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByTestId(`tecla-${teclaPin}`).click();
    await pausa(220);
  }
}

async function abrirBodega(page) {
  await page.getByText('Piscigiros').click();
  await page.waitForURL(/\/contar\//);
  await page.getByText(/artículos/).first().waitFor();
}

async function buscarArticulo(page, texto, filaExacta) {
  const buscador = page.getByPlaceholder('Buscar artículo…');
  await buscador.fill('');
  await buscador.pressSequentially(texto, { delay: 110 });
  await pausa(500);
  await page.getByText(filaExacta, { exact: true }).click();
  await pausa(600);
}

async function teclear(page, digitos) {
  for (const d of digitos) {
    await page.getByTestId(`tecla-${d}`).click();
    await pausa(350);
  }
  await pausa(700);
}

const guardar = (page) => page.getByRole('button', { name: 'Guardar' }).click();

// ── Beat 1 · El 9→90 muere en cámara (incluye ingreso: sirve de toma "Qué construimos") ──
async function beat1(browser) {
  const { page, marca, cerrar } = await nuevoClip(browser, 'beat1');
  await ingresar(page, 'Ana Gómez', '1');
  marca('pin_listo');
  await pausa(800);
  await abrirBodega(page);
  marca('lista_articulos'); // aquí se ve el 38/56 — toma del segmento "Qué construimos"
  await pausa(2500);
  await buscarArticulo(page, 'ACEITE', 'ACEITE');
  marca('aceite_elegido');
  await teclear(page, ['9', '0', '0']);
  await guardar(page);
  await page.getByText('Verificación de cantidad').waitFor();
  marca('dialogo_verificacion');
  await pausa(4200); // la banda amarilla se lee en cámara: «la app me detiene antes de guardar»
  await page.getByRole('button', { name: '¿Eran 90?' }).click();
  marca('eran_90');
  await pausa(1000);
  await guardar(page);
  await page.getByText(/ACEITE · 90/).waitFor();
  marca('guardado_90');
  await pausa(2200);
  await cerrar();
}

// ── Beat 2 · Sin red: se cuenta igual, y al volver la señal sube solo ──
async function beat2(browser) {
  const { context, page, marca, cerrar } = await nuevoClip(browser, 'beat2');
  await ingresar(page, 'Ana Gómez', '1');
  await abrirBodega(page);
  await pausa(1500); // el catálogo ya quedó en IndexedDB: ahora sí puede irse la red
  await context.setOffline(true);
  await page.getByText('Sin red').waitFor();
  marca('sin_red');
  await pausa(1500);
  await buscarArticulo(page, 'AGUA 280', 'AGUA 280 ML');
  await teclear(page, ['3', '0']); // stock 24 → exp10 1: 30 no dispara verificación
  await guardar(page);
  await page.getByText(/AGUA 280 ML · 30/).waitFor();
  marca('primera_captura_offline');
  await pausa(1200);
  await buscarArticulo(page, 'AGUA BOTELLA', 'AGUA BOTELLA');
  await teclear(page, ['4', '1', '8']); // stock 423 → exp10 2: 418 en escala
  await guardar(page);
  await page.getByText(/Sin red · 2 por enviar/).waitFor();
  marca('dos_por_enviar');
  await pausa(2800); // «la cabecera lleva la cuenta de lo que está por enviar»
  await context.setOffline(false);
  marca('vuelve_la_red');
  await page.getByText('Sin red').waitFor({ state: 'hidden', timeout: 25_000 });
  marca('cola_drenada'); // «al volver la señal, sube solo»
  await pausa(2200);
  await cerrar();
}

// ── Beat 3 · Merma con evidencia fotográfica ──
async function beat3(browser) {
  const { page, marca, cerrar } = await nuevoClip(browser, 'beat3');
  await ingresar(page, 'Ana Gómez', '1');
  await abrirBodega(page);
  await buscarArticulo(page, 'AGUA BOTELLA', 'AGUA BOTELLA');
  marca('articulo_elegido');
  await teclear(page, ['2']);
  await page.getByRole('button', { name: 'Registrar merma' }).click();
  marca('modo_merma');
  await pausa(1000);
  await page.getByRole('button', { name: 'Dañado o roto' }).click();
  await pausa(900);
  await page.locator('input[type="file"]').setInputFiles(FOTO);
  await page.getByText(/evidencia lista/).waitFor();
  marca('foto_adjunta');
  await pausa(1800);
  await page.getByRole('button', { name: 'Registrar baja' }).click();
  await page.getByText(/baja por/).waitFor();
  marca('baja_registrada');
  await pausa(2200);
  await cerrar();
}

// ── Beat 4 · La líder: diferencias, cierre firmado, Excel en su formato ──
async function beat4(browser) {
  const { page, marca, cerrar } = await nuevoClip(browser, 'beat4');
  await ingresar(page, 'Bibiana Torres', '9');
  await abrirBodega(page);
  await page.getByRole('button', { name: 'Cierre' }).click();
  await page.waitForURL(/\/lider\//);
  marca('panel_lider');
  await pausa(2500);
  await page.getByRole('button', { name: /^Diferencias/ }).click();
  // "Sin explicar" existe dos veces: tabla (visible ≥640px) y tarjetas (ocultas aquí).
  await page.getByText('Sin explicar').filter({ visible: true }).first().scrollIntoViewIfNeeded();
  marca('diferencias'); // columna "Sin explicar": la merma explica 2, quedan 3
  await pausa(3200);
  await page.getByRole('button', { name: /^Merma/ }).click();
  marca('merma_con_foto');
  await pausa(2500);
  await page.getByRole('button', { name: 'Cerrar conteo' }).click();
  await page.getByText('Cerrar el conteo').waitFor();
  await page
    .getByPlaceholder(/Nota del cierre/)
    .pressSequentially('Diferencias revisadas · merma con evidencia', { delay: 45 });
  await pausa(800);
  await page.getByRole('button', { name: 'Cerrar conteo' }).last().click(); // el confirm del modal
  await page.getByText('Auditoría cerrada.').waitFor();
  marca('auditoria_cerrada'); // queda firmada con nombre y hora en el servidor
  await pausa(2200);
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Excel/ }).click(),
  ]);
  await descarga.saveAs(path.join(OUT, 'export.xlsx'));
  marca('excel_descargado');
  await pausa(2500);
  await cerrar();
}

const seleccion = (process.env.BEATS ?? 'beat1,beat2,beat3,beat4').split(',');
const browser = await chromium.launch();
try {
  for (const beat of [beat1, beat2, beat3, beat4].filter((b) => seleccion.includes(b.name))) {
    console.log(`▶ ${beat.name}`);
    await beat(browser);
  }
} finally {
  await browser.close();
  fs.writeFileSync(rutaTiempos, JSON.stringify(tiempos, null, 2));
}
console.log('Clips listos en', OUT);
