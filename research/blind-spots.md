# Blind spots — what we know vs. what we're guessing

**Closed out 2026-07-25**, after the app shipped. This doc served its purpose: it kept us honest
about which design decisions rested on evidence and which rested on guesses. Below, every guess is
marked with what actually happened to it in the build.

Sources: `reto/reto-04-hoteleria.md`, `lives/` (5 analyzed sessions), `datos/BODEGAS-Y-STOCK-perfil.md`.
Where a row says "shipped as", the authority is the code in `app/`, not this document.

## KNOWN — what we built on

**The problem (official brief + live):**
- Monthly blind count, bodega by bodega, by grupos de familia; paper → líder de costos types it (~**2 days of digitación per cycle**) → auditor reviews. Errors: 9↔90, handwriting (3↔5), g vs kg.
- Pilot scope = **Piscilago park only** (~48 bodegas); hotels are the future rollout if it works. **Correction from the dataset (2026-07-23):** the live's "1,400+ artículos" is the whole dataset (1,405 stock rows across the 8 bodegas with sheets; 936 distinct articles; 56–344 rows per bodega) — NOT 1,400 per bodega. See `datos/BODEGAS-Y-STOCK-perfil.md`.
- Catalog is heterogeneous: food + pool chemicals + animal supplies + meds + frozen + menaje. Homologated names (20 rice suppliers → "arroz") but real variants stay separate ("arroz doña pepa").
- Backing system: **Oracle Simphony / "My Inventory"** (?) — it generates the per-bodega count format (product + unit). Never confirmed.
- Partial counts allowed (open packages weighed); prepared portions are their own catalog article. Recipe tracking explicitly **out of scope**.
- **How stock gets there (answered 2026-07-25, after the build):** supplier → *almacén principal* of the Hotel/Club/Parque → each tienda/bodega pulls what it needs through the inventory system. It arrives on **paper** — remisión or factura — received by the almacenista *or* the auxiliar, not a fixed person. Full Q&A in [`proceso-recepcion-mercancia.md`](proceso-recepcion-mercancia.md). It confirmed the rotating-operator and paper-first assumptions; it changed nothing that shipped.

**Hard design constraints (from the lives — these invalidated common defaults):**
1. **Tablets only.** Personal phones/WhatsApp banned by Colsubsidio policy inside bodegas. → **Shipped as** a tablet-first PWA; no WhatsApp path was ever built.
2. **Offline-capable is required.** Not all bodegas have corporate network. → **Shipped as** device-first writes + deferred sync with an idempotency key generated on the device.
3. **Count stays blind.** Never show the system's expected quantity mid-count. → **Shipped as** a hard guarantee: the device receives only the *order of magnitude*, never `sd`, and `app/apps/api/src/conteoCiego.test.ts` fails the build if that field leaks through any route.
4. **Barcodes can't carry the load.** Not all products have a unique ID → fuzzy matching is the core technical problem. → **Shipped as** the name matcher in `app/packages/core/src/fuzzy.ts`, plus printable QR shelf labels for uncoded products.
5. **Voice agent is pre-validated**: Colsubsidio's own moderator proposed it unprompted. → **Shipped as** one of four input methods (voice, scan, search, tap), deliberately not the only one — see A2 below.
6. **Counted-vs-system report**: written brief says "bonus", the business owner named it in her core wish list. → **Shipped as** a 3-sheet Excel export.

**Rules (apertura):** deadline Sun 07-26 11:30am Colombia; public repo created ≥07-22, no commits after; demo link + 2-min pitch video; one reto per team; judging = impact, smart AI use, technical execution + viability at Colsubsidio scale, pitch; hardware solutions disadvantaged; IP stays ours (12-month eval license); per-reto WhatsApp group = official Q&A channel.

## ASSUMED — how each guess turned out

| # | Assumption | Outcome |
|---|---|---|
| A1 | Output = importable file mirroring the system-generated format's columns | **Never confirmed by Colsubsidio.** Shipped anyway as the safest bet: the `CONTEO` sheet mirrors the input file's columns, with flat CSV as a fallback. Declared as a limitation in `app/README.md` §8. |
| A2 | Warehouse noise is manageable for ASR (push-to-talk + confirmation as hedge) | **Never validated — so we removed the dependency.** Voice is one of four input methods; keyboard and search work at 100% without it. The architecture doesn't bet on ASR. |
| A3 | Anomaly detection = explainable heuristics on snapshot dirt, not an ML model | **Held.** Shipped as **9 rules** in `app/packages/core/src/anomalias.ts`, each traceable to something real in the dataset. No model trained. |
| A4 | Demo judged on a simulated count, not on-site | **Held.** Judged via a live link + 2-min video; a seeded demo is the right optimization. |
| A5 | Counter registers quantity in the catalog's unit | **Refined.** The parser accepts grams, converts to the catalog unit and *shows the conversion*; a unit that can't correspond **blocks** the save instead of guessing. |

## UNKNOWN — what never got answered, and how we covered it

The WhatsApp group never produced answers on these. Each one is handled by a stated decision rather
than left open — that's the difference between a blind spot and a documented limitation.

| # | Question | How the build covers it |
|---|---|---|
| 1 | Historical series? | Confirmed absent — the file is a single cut. Anomaly rules lean on the cut's order of magnitude, not on trends. Declared in `app/README.md` §8.6. |
| 2 | A real filled-in paper sheet | Never delivered. Not a blocker: the input xlsx is officially *"el mismo formato que el personal digita"*. |
| 3 | Export column spec + exact system name | Never answered. Mirrored the input columns + CSV fallback; declared as limitation §8.2. |
| 4 | Lot/expiry capture | Never discussed. Out of the shipped scope; would extend the capture payload. |
| 5 | Tablet specifics (OS, shared, mic) | Never answered. PWA over HTTPS runs on any modern tablet; shared-device auth is user + 4-digit PIN (§8.3). |
| 6 | Noise conditions in bodegas | Never answered → the reason voice is optional, not required (A2). |
| 7 | Hotelería-specific judging weights | Never published. Built against the general 4 criteria. |
| 8 | Cloud AI API restrictions | Never discussed. Mitigated by design: the matcher, parser and rules are dependency-free TypeScript running **on the device** — no inventory data leaves it for a third-party model. |
| 9 | Concurrent counting protocol | Answer was incoherent on air. Assumed a family-group split and said so; groups are derived by keyword (§8.4). |

## What this doc got right, and wrong

- **Right:** refusing to build a WhatsApp bot, treating fuzzy matching as the crux rather than
  barcodes, and treating the counted-vs-system report as mandatory instead of bonus. All three came
  from the lives and all three survived into the product.
- **Wrong:** the "1,400 artículos per bodega" reading of the live, corrected only when the real file
  was profiled. Worth remembering that a spoken number in an auto-transcript is the weakest evidence
  we handled all week.
