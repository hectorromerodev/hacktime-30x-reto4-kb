# Questions for Colsubsidio — final status

**Closed 2026-07-25.** The lives are over and the open items below never got an answer. This is kept
as the record of what we asked, what we got, and what we decided on our own when the answer never
came.

**Channel used:** the per-reto WhatsApp support group (the official Q&A channel) + YouTube comments
during lives.

> **One questionnaire *was* answered** — the one about the physical reception process (how product
> arrives before it is ever counted). It landed too late to change the build and it covers the
> adjacent event rather than the count itself, so it lives in its own document:
> [`proceso-recepcion-mercancia.md`](proceso-recepcion-mercancia.md).

## Never answered — and what we decided instead

Each of these shipped as a stated decision, not as a gap. Where the answer would have changed the
build, the decision is declared in `app/README.md` §8 (Limitaciones declaradas).

| # | What we asked | Decision taken |
|---|---|---|
| 1 | ¿El Excel es un corte único o hay histórico de meses anteriores? ¿Vale generar datos sintéticos? | Confirmed single cut. **No synthetic history was used.** The anomaly rules lean on the cut's order of magnitude instead of on trends — honest, and it still catches the 9→90. |
| 2 | ¿Una foto real del formato en papel diligenciado? | Never delivered. Not needed: the input xlsx is officially *"el mismo formato que el personal digita"*. |
| 3 | ¿La cantidad se registra siempre en la unidad del catálogo, o cuentan en cajas/bultos y alguien convierte? | Unanswered. The parser converts grams→kilos and **shows** the conversion; an impossible unit blocks the save rather than guessing a factor. |
| 4 | ¿Registran lote y fecha de vencimiento (medicamentos, congelados)? | Unanswered. Left out of scope; it would double the capture payload. |
| 5 | ¿Qué estructura de archivo le sirve al líder de costos? ¿Nombre exacto del sistema? | Asked twice, answer garbled both times. Export mirrors the input file's columns + flat CSV fallback. |
| 6 | ¿Qué tablets usan? ¿Micrófono usable con guantes? | Unanswered. PWA over HTTPS on any modern tablet; shared-device auth = user + 4-digit PIN. |
| 7 | ¿Cuánto ruido ambiente hay en las bodegas? | Unanswered — **this is why voice is optional**. Keyboard, search and scan work at 100% without it. |
| 8 | ¿Criterios y pesos específicos del reto Hotelería? | Never published (Seguros got theirs on air, Hotelería didn't). Built against the general four criteria. |
| 9 | ¿Restricciones para procesar inventario con APIs de IA en la nube? | Unanswered. Sidestepped: matcher, parser and rules are dependency-free TypeScript running on the device — inventory data doesn't leave it for a third-party model. |
| 10 | ¿Dos personas en la misma bodega se reparten por grupos de familia? | Answer was incoherent on air. Assumed a family-group split and declared the assumption; groups are derived by keyword. |

## Answered — the ones that shaped the build

| Question | Answer | Source |
|---|---|---|
| Scale? | Pilot = **Piscilago only**: ~48 bodegas. *(The live's "1,400+ artículos c/u" was later corrected by the real file: 1,405 rows total, 936 distinct articles, 56–344 per bodega.)* | explicación live + `datos/` profile |
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
| Dataset? | Excel under Recursos → "bodegas y stock" + tutorial, on innovacion.colsubsidio.com | explicación live |
| Deadline & deliverables? | Sun 07-26 11:30am COL; public repo (created ≥07-22, no commits after) + demo link + 2-min video | apertura live |
| Judging (general)? | Impact, smart AI use, technical execution + viability at Colsubsidio scale, pitch; hardware disadvantaged | apertura live |
| Pitch format? | 2 min video (problem, solution, demo, impact); finalists get 2 min + 3 min jury Q&A | apertura + pitch charla |

## The lesson worth keeping

Nine of the ten questions we most wanted answered never got an answer. The build survived because
every unanswered question became a **declared decision** instead of a silent assumption — which is
also the thing a jury that knows the process can actually check.
