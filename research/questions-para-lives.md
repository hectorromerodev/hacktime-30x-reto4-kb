# Questions to ask — Reto 4 (WhatsApp group / lives / mentorías)

**Channel:** the per-reto **WhatsApp support group** is the official Q&A channel for the rest of the week (confirmed in the explicación live); YouTube comments are also monitored during lives.

Pruned 2026-07-22 against the explicación live (`lives/2026-07-22-explicacion-reto4-sVcLdIF0bjo.md`) — everything already answered moved to the log at the bottom. Ready to paste, in Spanish.

## 🥇 Ask first (datos — build depends on these)

1. **Sobre el Excel de "bodegas y stock": ¿es una foto de un solo corte de inventario, o nos pueden compartir varios cortes históricos (meses anteriores) de una misma bodega? Si no hay histórico, ¿es válido que generemos datos sintéticos para demostrar la detección de anomalías?**
   *Why: anomaly detection "según el patrón de esa bodega" needs history; the shared Excel looks like a single snapshot.*
2. **¿Nos pueden compartir una foto real (o ejemplo) del formato en papel ya diligenciado a mano?** — en el live quedaron de averiguar si se podía.
   *Why: it's the exact input we're replacing; also great demo material. They said "a ver si podemos obtener un ejemplo" — chase it.*
3. **En el formato que genera el sistema, ¿la cantidad se registra siempre en la unidad de medida del catálogo, o a veces cuentan en otra presentación (cajas, bultos) y alguien convierte después? ¿Existen factores de conversión en el sistema?**
   *Why: unit disambiguation is a scored requirement; conversions are where it breaks.*
4. **¿En la toma física registran lote y fecha de vencimiento (medicamentos, congelados), o solo cantidades?**
   *Why: doubles the capture payload if yes; catalog includes meds and frozen goods.*

## 🥈 Output & devices

5. **Para dejar el dato "listo para el ERP" sin integración real: ¿qué estructura de archivo le serviría al líder de costos para cargarlo — las mismas columnas del formato que genera el sistema (¿Oracle Simphony / My Inventory?)? ¿Nos pueden confirmar el nombre del sistema?**
   *Why: the export shape = "implementable" in judges' eyes; the live gave three garbled system names and an inconclusive answer on columns.*
6. **Ya que celulares personales no están permitidos pero tablets sí: ¿qué tablets usarían (Android/iPad, corporativas compartidas por bodega)? ¿Tienen micrófono utilizable con guantes/manos ocupadas?**
   *Why: device target for the build; push-to-talk vs hands-free design.*
7. **¿Qué tanto ruido ambiente hay durante la toma (motores de refrigeración, cocinas, zonas del parque)?**
   *Why: voice capture viability; never raised in the live.*

## 🥉 Evaluación y restricciones

8. **¿Cuáles son los criterios de evaluación (y pesos) específicos para el reto de Hotelería? Para Seguros los mencionaron en el live, para Hotelería no alcanzaron.**
   *Why: one podium, 4 retos — we need to know what moves the needle.*
9. **¿Hay restricciones para procesar datos de inventario con APIs de IA en la nube (Gemini, Claude, etc.), pensando en la implementación real con Colsubsidio?**
   *Why: winners go to product implementation; a compliance-blocked stack kills viability points.*
10. *(nice-to-have)* **Cuando dos personas cuentan la misma bodega, ¿se dividen por grupos de familia o cada una cuenta todo (doble conteo)?**
    *Why: asked in the live, answer came out incoherent; safe to assume family-group split, but a clean answer helps.*

## ✅ Answered log (don't re-ask)

| Question | Answer | Source |
|---|---|---|
| Scale? | Pilot = **Piscilago only**: ~48 bodegas, ~1,400+ artículos c/u; hotels are future rollout | explicación live |
| Blind count? | **Sí, deliberadamente ciega** (auditoría) — never show expected qty mid-count | explicación live |
| Connectivity? | **Not guaranteed** — not all bodegas have corporate network → offline needed | explicación live |
| Barcodes? | **Not universal** — some products lack unique ID in the app → fuzzy matching required | explicación live |
| Devices? | Personal phones/WhatsApp **banned by policy**; **tablets allowed** | explicación live |
| Partial counts? | Fractions allowed (medio kilo, caja + sueltas); open packages weighed; prepared portions = own article | explicación live |
| Who counts/types? | 1–3 count + 1 audits (usually 2); **líder de costos** does the typing (~2 days/month) | explicación live |
| Frequency? | Mostly monthly; dated to last day of month | explicación live |
| Recipes? | Recipe/preparation tracking **out of scope** (confirmed twice) | explicación live |
| Anomaly threshold? | **Left to the team** — no mandated model/threshold; negative balances & weird decimals cited as known dirt | explicación live |
| Catalog breadth? | Not just food: pool chemicals, animal supplies, meds, frozen, menaje — all counted | explicación live |
| Dataset? | Excel example under Recursos → "bodegas y stock" + tutorial, on innovacion.colsubsidio.com | explicación live |
| Deadline & deliverables? | Sun 07-26 11:30am COL; public repo (created ≥07-22, no commits after) + demo link + 2-min video | apertura live |
| Judging (general)? | Impact, smart AI use, technical execution + viability at Colsubsidio scale, pitch; hardware disadvantaged | apertura live |

## Log of asks

| Date | Where | Questions asked | Answered? → logged where |
|---|---|---|---|
| | | | |
