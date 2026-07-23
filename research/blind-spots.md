# Blind spots — what we know vs. what we're guessing

Updated 2026-07-22 after analyzing the apertura + explicación-reto-4 lives. Sources: `reto/reto-04-hoteleria.md`, `lives/2026-07-22-apertura-DNi722_GAgw.md`, `lives/2026-07-22-explicacion-reto4-sVcLdIF0bjo.md`.

## KNOWN — build on this

**The problem (official brief + live):**
- Monthly blind count, bodega by bodega, by grupos de familia; paper → líder de costos types it (~**2 days of digitación per cycle**) → auditor reviews. Errors: 9↔90, handwriting (3↔5), g vs kg.
- Pilot scope = **Piscilago park only** (~48 bodegas); hotels are the future rollout if it works. **Correction from the dataset (2026-07-23):** the live's "1,400+ artículos" is the whole dataset (1,405 stock rows across the 8 bodegas with sheets; 936 distinct articles; 56–344 rows per bodega) — NOT 1,400 per bodega. See `datos/BODEGAS-Y-STOCK-perfil.md`.
- Catalog is heterogeneous: food + pool chemicals + animal supplies + meds + frozen + menaje. Homologated names (20 rice suppliers → "arroz") but real variants stay separate ("arroz doña pepa").
- Backing system: **Oracle Simphony / "My Inventory"** (?) — it generates the per-bodega count format (product + unit). Confirm exact name in WhatsApp group.
- Partial counts allowed (open packages weighed); prepared portions are their own catalog article. Recipe tracking explicitly **out of scope**.

**Hard design constraints (from the lives — these invalidate common defaults):**
1. **Tablets only.** Personal phones/WhatsApp banned by Colsubsidio policy inside bodegas. → No WhatsApp-bot capture; tablet app/PWA is the sanctioned form factor.
2. **Offline-capable is required.** Not all bodegas have corporate network.
3. **Count stays blind.** Never show the system's expected quantity mid-count (audit integrity). Anomaly flags come after capture, before saving.
4. **Barcodes can't carry the load.** Not all products have a unique ID in the app → fuzzy voice/text matching against the catalog is the core technical problem.
5. **Voice agent is pre-validated**: Colsubsidio's own moderator proposed a voice agent unprompted. Building toward that mental model is low-risk.
6. **Counted-vs-system report**: written brief says "bonus", but the business owner named it in her core wish list → treat as near-mandatory.

**Rules (apertura):** deadline Sun 07-26 11:30am Colombia; public repo created ≥07-22, no commits after; demo link + 2-min pitch video; one reto per team; judging = impact, smart AI use, technical execution + viability at Colsubsidio scale, pitch; hardware solutions disadvantaged; IP stays ours (12-month eval license); per-reto WhatsApp group = official Q&A channel.

**Data:** Excel inventory example + tutorial under Recursos → "bodegas y stock" on innovacion.colsubsidio.com (platform opened 07-23). Units seen: unidades, kilogramos, litros. Our xlsx in `datos/` (profile pending).

## ASSUMED — validate before building on it

| # | Assumption | Status | Risk if wrong |
|---|---|---|---|
| A1 | Output = importable file mirroring the system-generated format's columns | Column spec question got a garbled answer — re-ask | We build an export nobody can load |
| A2 | Warehouse noise is manageable for ASR (push-to-talk + confirmation loop as hedge) | Never discussed | Voice capture flops in demo narrative |
| A3 | Anomaly detection = well-founded heuristics on history/snapshot dirt (negative balances, weird decimals, magnitude jumps) | Supported — explicitly left to the team | Over-engineering an ML model nobody asked for |
| A4 | Demo judged on simulated count, not on-site | Consistent with hybrid format, unconfirmed | Wrong demo optimization |
| A5 | Counter registers quantity in the catalog's unit (format pre-prints unit) | Implied by the paper format; conversions unaddressed | Unit-conversion layer missing |

## UNKNOWN — the remaining blind spots (→ `questions-para-lives.md`)

1. **Historical data**: is the Excel a single snapshot? Any multi-month history available, or do we synthesize it for the anomaly demo?
2. **Real filled paper sheet**: promised "a ver si podemos" — chase it.
3. **Export column spec** + exact system name (Simphony vs My Inventory).
4. **Lot/expiry capture** for meds/frozen.
5. **Tablet specifics** (OS, shared per bodega, mic).
6. **Noise conditions** in bodegas.
7. **Hotelería-specific judging criteria/weights** (Seguros got theirs on stream; Hotelería didn't).
8. **Cloud AI API restrictions** for the real implementation.
9. *(minor)* Concurrent counting protocol — assume family-group split and state the assumption.
