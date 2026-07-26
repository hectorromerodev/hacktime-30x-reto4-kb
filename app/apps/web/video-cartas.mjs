// Genera las cartas de título (pantalla completa) y los paneles laterales de
// cada beat como PNG 1920×1080, con la identidad de la app (globals.css).
// Uso: OUT=/ruta/cartas node video-cartas.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT ?? './cartas';
fs.mkdirSync(OUT, { recursive: true });

const css = `
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; background: #f4f6fa; color: #0a2540;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    display: flex; overflow: hidden;
  }
  .carta { width: 100%; padding: 140px 180px; display: flex; flex-direction: column; justify-content: center; }
  .panel { width: 1000px; padding: 120px 90px 120px 110px; display: flex; flex-direction: column; justify-content: center; }
  .kicker { font-size: 30px; font-weight: 700; letter-spacing: .14em; color: #004b8d; margin-bottom: 36px; }
  .kicker::before { content: ''; display: inline-block; width: 52px; height: 14px; background: #ffd000; margin-right: 20px; }
  h1 { font-size: 88px; line-height: 1.12; font-weight: 800; letter-spacing: -.015em; margin-bottom: 44px; }
  .panel h1 { font-size: 64px; }
  p { font-size: 38px; line-height: 1.45; color: #4a5d72; max-width: 24em; }
  .panel p { font-size: 32px; }
  .pills { display: flex; gap: 24px; margin-top: 56px; }
  .pill { background: #0a2540; color: #fff; border-radius: 999px; padding: 22px 44px; font-size: 34px; font-weight: 700; }
  .nota { margin-top: 56px; font-size: 30px; color: #4a5d72; border-left: 6px solid #ffd000; padding-left: 24px; }
`;

const cartas = {
  carta1: `<div class="carta">
    <div class="kicker">EL PROBLEMA</div>
    <h1>Un <span style="color:#c0392b">9</span> leído como <span style="color:#c0392b">90</span> descuadra la bodega entera.</h1>
    <p>1.405 renglones de inventario tecleados a mano cada cierre. 48 bodegas. Dos días de redigitación al mes.</p>
    <div class="nota">El error nace siempre en el mismo punto: cuando alguien captura lo que contó.</div>
  </div>`,
  carta2: `<div class="carta">
    <div class="kicker">QUÉ CONSTRUIMOS</div>
    <h1>Conteo · Piscilago</h1>
    <p>La tablet captura el conteo en el piso: el contador habla, teclea o escanea — y la app marca lo que no cuadra <b style="color:#0a2540">antes de guardar</b>.</p>
    <div class="pills"><div class="pill">Funciona sin red</div><div class="pill">El conteo sigue siendo ciego</div></div>
  </div>`,
  carta3: `<div class="carta">
    <div class="kicker">POR QUÉ IMPORTA</div>
    <h1>Todo corre dentro de la tablet.</h1>
    <p>Ningún dato de inventario sale a un modelo de terceros. Esta es la IA que <b style="color:#0a2540">sí</b> se puede desplegar en una bodega sin señal. La app marca — la persona decide.</p>
  </div>`,
  carta4: `<div class="carta">
    <div class="kicker">EQUIPO</div>
    <h1 style="font-size:64px">Hector Romero · Ayrton Santos<br>Gerardo Martinez · Rodrigo Sauceda</h1>
    <p>No es maqueta: desplegado, con 96 tests unitarios y de API + 9 E2E, PWA en las tablets que ya tienen.</p>
    <div class="nota">Siguiente paso: piloto en Piscilago el próximo cierre de mes.<br>Y de frente: la voz necesita red — por eso nunca es el único camino.</div>
  </div>`,
  panel1: `<div class="panel">
    <div class="kicker">BEAT 1 · EL ERROR DEL BRIEF</div>
    <h1>Capturé 900. La app me detiene antes de guardar.</h1>
    <p>El sistema tiene 30,59 L — y ese número nunca aparece. La app conoce la escala, no la cantidad. Solo pregunta: ¿no eran 90?</p>
  </div>`,
  panel2: `<div class="panel">
    <div class="kicker">BEAT 2 · SIN RED</div>
    <h1>Modo avión. Se sigue contando.</h1>
    <p>Se guarda al instante y la cabecera lleva la cuenta de lo que está por enviar. Al volver la señal, sube solo — y reenviar el mismo lote no duplica nada.</p>
  </div>`,
  panel3: `<div class="panel">
    <div class="kicker">BEAT 3 · MERMA CON EVIDENCIA</div>
    <h1>Dos botellas rotas: merma, con su foto.</h1>
    <p>El descuadre deja de ser un misterio: es una diferencia explicada, con evidencia.</p>
  </div>`,
  panel4: `<div class="panel">
    <div class="kicker">BEAT 4 · LA LÍDER DE COSTOS</div>
    <h1>Contado contra sistema, sin descargar nada.</h1>
    <p>Cuánto queda sin explicar, la merma con sus fotos. Cierra la auditoría — firmada con su nombre y su hora — y el Excel sale con las columnas de su propio formato.</p>
  </div>`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [nombre, cuerpo] of Object.entries(cartas)) {
  await page.setContent(`<style>${css}</style>${cuerpo}`);
  await page.screenshot({ path: path.join(OUT, `${nombre}.png`) });
  console.log(nombre, 'lista');
}
await browser.close();
