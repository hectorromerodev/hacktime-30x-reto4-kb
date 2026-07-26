# Plan Hackathon 30× — Reto 4 Hotelería (Colsubsidio)

**Repo:** `hacktime-30x-reto4-kb`
**Live:** https://conteo-inventarios.vercel.app
**Objetivo:** Ganar el hackathon con demo 2 min que impresione a jueces

> Este plan refleja el estado **real** de `main` (reconciliado contra el historial de
> commits). La mayoría del core y varias features "wow" ya están en producción; lo que
> queda es un backlog priorizado, sin calendario.

---

## 1. Estado actual — lo que ya está en `main`

| Área | Estado | Dónde |
|---|---|---|
| **Conteo ciego real** (nunca revela expected; R8 usa `exp10`) | ✅ | prueba `apps/api/src/conteoCiego.test.ts` |
| **Offline-first** (Dexie + SW + sync idempotente) | ✅ | indicador de conexión refleja el **servidor**, no solo la interfaz |
| **Fuzzy match por nombre** (99.4% acc@5, <1ms, sin red) | ✅ | `packages/core/src/fuzzy.ts` + `eval/` |
| **9 reglas de anomalía R1–R9** | ✅ | `packages/core/src/anomalias.ts` (+ tests) |
| **Corrección R8 "Corregir a 90"** (botón en el diálogo) | ✅ | acción `CORREGIR_A` |
| **Export 3 hojas** CONTEO / DIFERENCIAS / TRAZABILIDAD | ✅ | dependencia `xlsx` eliminada |
| **Merma con evidencia fotográfica** + comando de voz `MERMA` | ✅ | `contar/[conteoId]` |
| **Dictado continuo por voz** (mic se reabre solo tras cada frase) | ✅ | `apps/web/lib/voz.ts` |
| **Página de diagnóstico de micrófono** | ✅ | `/diagnostico` |
| **Etiquetas QR** (imprime lo que el QR codifica = nº de artículo) | ✅ | `/etiquetas/[conteoId]` |
| **Escáner QR** iPhone/iPad, auto-scan, salida visible | ✅ | `contar/[conteoId]` |
| **Vista líder** pantalla completa + cierre de conteo | ✅ | `/lider/[conteoId]` |
| **Conflicto entre contadores** (item sin cantidad hasta que el líder decide) | ✅ | R7 + `yaContadoPor` |
| **Retomar conteo en otra tablet** sin romper el ciego | ✅ | — |
| **Tests** 61 unitarios + E2E Playwright contra backend real | ✅ | `pnpm test` / Playwright |
| **Deploy en Vercel** + datos demo + roles por PIN | ✅ | Ana `1111` / Bibiana (líder) `9999` |
| **Guion pitch 2 min** minutado + **guion Q&A jurado** | ✅ | `docs/` |

**Reglas de anomalía (códigos reales en `main`):**

`R1_DECIMAL_EN_UNIDAD` · `R2_NEGATIVO` · `R3_UNIDAD_DISCORDANTE` ·
`R4_MATCH_DEBIL` · `R5_CERO_EXPLICITO` · `R6_MAGNITUD_ABSURDA` ·
`R7_DUPLICADO_EN_SESION` · `R8_SALTO_DE_MAGNITUD` · `R9_ENVASE_SIN_FACTOR`

---

## 2. Cobertura preguntas Colsubsidio

| # | Pregunta | Estado |
|---|----------|--------|
| 5 | ¿Conteo es ciego? | ✅ regla dura; test que falla si se filtra el expected |
| 9 | ¿Todos los puntos tienen red? | ✅ offline-first, sync idempotente |
| 11, 17 | ¿Código de barras / ID único? | ✅ nombre = clave, fuzzy 99.4% |
| 1, 3 | Dataset real sucio | ✅ parser NBSP, truncación 40c, negativos |
| 7 | Export validación | ✅ 3 hojas |
| 13 | Umbrales anomalía | ✅ 9 reglas R1–R9 |
| 8 | Dispositivos permitidos | ✅ PWA tablet + Web Speech API + teclado + QR |
| 10 | ¿Manejan merma? | ✅ merma con evidencia fotográfica + comando de voz |
| 19 | ¿Cómo saben que ya contaron? | ⚠️ tracking `yaContadoPor` + confirmación "último contado"; falta chip por fila (G2) |
| 20 | ¿Conteo simultáneo 2 operadores? | ✅ R7 resuelve conflicto; líder decide; ítem queda sin cantidad hasta resolver |
| 4 | Lote / vencimiento | ⛔ fuera de alcance ("siguiente parte" — Colsubsidio) |
| 16 | Pesaje receta | ⛔ fuera de alcance ("siguiente parte") |

---

## 3. Backlog restante (priorizado por impacto/esfuerzo)

Sin calendario. En orden de "qué suma más al demo por menos trabajo".

### P1 · R8 Tooltip exp10 — "Suele estar 10–99" (S) ⭐⭐⭐
El botón *"Corregir a 90"* ya existe; falta explicar **por qué**. Convierte
"computadora dice no" en "ah, ya entiendo". Los buckets `exp10` son data única nuestra
y **nunca revelan la cantidad del sistema**.

```tsx
// En el diálogo de anomalías (contar/[conteoId])
const EXP10_LABELS = {
  0: '1–9 unidades', 1: '10–99 unidades', 2: '100–999 unidades',
  3: '1.000–9.999 unidades', 4: '10.000+ unidades',
};

{anomalia.codigo === 'R8_SALTO_DE_MAGNITUD' && anomalia.exp10 != null && (
  <Tooltip content={`En esta bodega suele estar entre ${EXP10_LABELS[anomalia.exp10]}`}>
    <InfoCircleIcon className="ml-1 text-amarillo-500 cursor-help" size={16} />
  </Tooltip>
)}
```

### P2 · Chip "✓ Contado" por fila (M) ⭐⭐⭐
Ya existe la confirmación de "último contado" y el tracking `yaContadoPor`; falta el
badge visual en cada fila de la lista de artículos. Cierra la pregunta 19 visualmente.

```tsx
{capturas.some(c => c.articuloId === a.id && c.usuarioNombre === usuario?.nombre) && (
  <span className="ml-2 inline-flex items-center rounded-full bg-verde-100 px-2 py-0.5 text-xs font-semibold text-verde-800">
    ✓ Contado
  </span>
)}
```

### P3 · Cold Storage Mode (M) ⭐⭐⭐⭐
Problema real documentado (guantes fallan en capacitivo, ~25% eficiencia perdida).
Solución software poco común → diferenciador.

```css
/* styles/cold-mode.css */
html[data-cold="true"] {
  --touch-target: 88px;     /* WCAG AAA + guantes */
  --font-weight: 700;
  --contrast-bg: #000; --contrast-text: #fff; --contrast-border: #fff;
  --spacing: 2rem; --animation-dur: 0ms;
}
html[data-cold="true"] button, html[data-cold="true"] input, html[data-cold="true"] [role="button"] {
  min-height: var(--touch-target); font-weight: var(--font-weight);
}
html[data-cold="true"] * { transition-duration: var(--animation-dur) !important; }
```

Toggle en el header + persistencia en `localStorage`, aplicando `document.documentElement.dataset.cold`.

### P4 · Comandos de voz en lenguaje natural (L) ⭐⭐⭐⭐⭐ — arriesgado
El dictado continuo ya funciona; esto añade **correcciones habladas** encima. Es el
mayor moat ("nadie hace correcciones en lenguaje natural") pero también el más frágil
en tablet → dejar para el final, con el teclado/QR siempre como fallback.

```typescript
// lib/voz.ts — parser de comandos sobre el dictado ya existente
export function parseComandoVoz(texto: string):
  | { tipo: 'REPETIR' }
  | { tipo: 'CORREGIR'; cantidad: number; unidad?: string }
  | { tipo: 'ES'; nombre: string }
  | { tipo: 'NINGUNO' } {
  const t = texto.trim().toLowerCase();
  if (t === 'repetir' || t === 'repita') return { tipo: 'REPETIR' };
  const c = t.match(/^corregir\s+(.+)$/);
  if (c) { const p = parseEnunciado(c[1]); return { tipo: 'CORREGIR', cantidad: p.cantidadTotal ?? 0, unidad: p.unidad }; }
  const e = t.match(/^es\s+(.+)$/);
  if (e) return { tipo: 'ES', nombre: e[1].trim() };
  return { tipo: 'NINGUNO' };
}
```

- `REPETIR` → reinicia el reconocimiento.
- `CORREGIR` → setea cantidad + unidad, cierra el diálogo.
- `ES` → filtra candidatos por fuzzy match, muestra chips clickeables.

### P5 · Onboarding offline wizard (M) ⭐⭐⭐
Hace tangible lo invisible: "descarga una vez, cuenta para siempre sin red". 4 pasos:
bodega → descargar catálogo (streaming con progreso) → SW listo → ¡a contar!.
Flag en `db.meta` (`onboarded`) para mostrarlo solo la primera vez.

---

## 4. Checklist verificación pre-demo

| Feature | Test | Pass |
|---|---|---|
| Conteo ciego | Buscar el expected en el payload de la tablet | No aparece; test verde |
| R8 salto magnitud | Teclear 900 donde exp10=1 | Pregunta "¿Eran 90?" + botón Corregir a 90 |
| Merma | Contar con motivo merma + foto | Aparece en hoja TRAZABILIDAD |
| Conflicto | 2 contadores mismo ítem | Queda sin cantidad; líder resuelve (RECUENTO/SUMAR) |
| Escaneo QR | Imprimir etiqueta → escanear | Selecciona el artículo directo (iPhone/iPad) |
| Offline | Modo avión → contar → volver | Sync sin duplicar (idempotencia) |
| Export | Cerrar conteo (líder) | Excel 3 hojas descarga |
| P1 R8 tooltip | Tap ℹ️ en R8 | "Suele estar 10–99" |
| P2 Chip | Contar ítem → volver a lista | Badge "✓ Contado" visible |
| P3 Cold | Toggle → botones 88px alto contraste | WCAG AAA |
| P4 Voz | "50 kilos" → "corregir 30" → "es harina" | Cantidad 30, chips candidatos |
| P5 Onboarding | Abrir en modo avión primera vez | Wizard → descarga → contar |

---

## 5. Entregables

1. ✅ **App en producción**: https://conteo-inventarios.vercel.app (offline-capable)
2. ⬜ **Demo 2 min grabado** (MP4) + link live — grabar 5–6 takes, backup en Drive
3. ✅ **README** orientado al jurado (arquitectura, decisiones, cómo correr)
4. ✅ **Guion pitch minutado** + **guion Q&A jurado** (en `docs/`)
5. ⬜ **docs/SIMULTANEO.md** — documentar la decisión de conteo simultáneo (opcional; ya
   está resuelto en código vía R7)

---

## 6. Riesgos y mitigación

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Web Speech API inestable en tablet | Media | Fallback siempre presente: teclado numérico grande + QR |
| Comandos de voz (P4) frágiles | Media | Feature aditiva; el dictado y el teclado no dependen de ella |
| Onboarding streaming falla iOS | Media | Probar Safari iOS; fallback descarga chunked |
| Demo grabada falla | Baja | 5 takes; backup en Google Drive |

---

## 7. Pitch 2 min — estructura ganadora

| Tiempo | Contenido |
|--------|-----------|
| **0–20s** | **Hook**: "Piscilago, 1405 filas, 48 bodegas, conteo mensual ciego. Un 9 leído como 90 cuesta miles. Y toma 2 días retypear en Oracle. Lo resolvimos." |
| **20–40s** | **Qué construimos**: "App tablet: el contador captura por voz/teclado/escaneo; la app valida contra catálogo, marca lo fuera de escala **antes de guardar**, la persona decide. Funciona sin red. El conteo sigue ciego." |
| **40–90s** | **Demo narrado**: ACEITE → teclear **900** → *"fuera de escala habitual"* → **¿Eran 90?** → guardar. Remate: *"el sistema decía 30,59 y ese número nunca apareció."* |
| **90–100s** | **Por qué importa**: "Offline de verdad, human-in-the-loop con override logueado, todo en tablet: ningún dato de inventario sale a terceros. La voz necesita red → por eso teclado/escaneo también." |
| **100–120s** | **Team + next**: "[Nombres]. Pilot Piscilago este mes si ganamos. Escala a 48 bodegas." |

**Tono:** enérgico, problema-first, humano en el centro. No lista features. No auto-intro.

---

## 8. Decisiones técnicas (defendibles en Q&A)

| Pregunta juez | Respuesta |
|--------------|-----------|
| ¿Por qué no Gemini Live API? | Requiere red constante; nuestro core **no tiene dependencia cloud** — Web Speech API nativa + fuzzy local |
| ¿Cómo validan fuzzy sin sesgar auditoría? | **Human-in-the-loop**: la app marca, la persona decide, cada override queda en TRAZABILIDAD |
| ¿Por qué exp10 y no valor esperado? | **Conteo ciego**: exp10 = orden de magnitud histórico, nunca revela la cantidad del sistema |
| ¿2 contadores mismo ítem? | R7 detecta → el ítem queda sin cantidad hasta que el líder decide (RECUENTO / SUMAR / CANCELAR) |
| ¿Escalabilidad 48 bodegas? | PWA + Dexie + sync idempotente = **cero servidor** en el camino crítico; API solo para export |

---

## 9. Comandos

```bash
cd app && pnpm dev          # Next.js web (3000)
cd app && pnpm dev:api      # Fastify API (3001)
cd app && pnpm build        # compila todo
cd app && pnpm test         # tests (core + api)
cd app && pnpm lint         # ESLint + Prettier
vercel --prod               # deploy
```

---

*Reconciliado contra `main` — Héctor Romero*
