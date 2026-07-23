# Blind spots — what we know vs. what we're guessing

Status 2026-07-22. Update as lives/mentorías answer things (move rows up, link the `lives/` doc that answered them).

## KNOWN (from official text + site)

- The full problem statement, success criteria, and out-of-scope list → `reto/reto-04-hoteleria.md`.
- Monthly count, done by the **equipo de costos**, bodega by bodega, in **hoteles y parques**.
- Error taxonomy the organizers care about: transposition (9→90), handwriting, unit confusion (g vs. kg).
- ERP is out of bounds both ways: don't replace it, don't really integrate with it. Endpoint = clean data ready for it.
- Catalog + per-bodega stock history exist and are "un activo" we're expected to lean on.
- One podium across 4 retos; winners go to product implementation → **implementability counts**.
- We have an official xlsx from organizers (→ `datos/`, profile pending).

## ASSUMED (reasonable, but validate before building on it)

| # | Assumption | Risk if wrong |
|---|---|---|
| A1 | Output format = importable file/table (CSV/xlsx) a digitador can load | We build a fancy API nobody asked for |
| A2 | Spanish (Colombian) voice input, noisy warehouse environment | ASR accuracy tanks in demo |
| A3 | Counters may use personal phones (WhatsApp viable) | Corporate policy may ban personal devices in bodega |
| A4 | Anomaly detection can be threshold/heuristic on history — no ML training expected | Over/under-engineering the "IA" layer |
| A5 | Catalog has standard unit-of-measure per product + package presentations | Unit disambiguation design breaks |
| A6 | Demo will be judged on a simulated count, not on-site | We optimize for the wrong demo |

## UNKNOWN (the real blind spots — each maps to a question in `questions-para-lives.md`)

1. **Data**: do we get a real (anonymized) catalog + stock history extract, or do we fabricate synthetic data? Format? Scale (SKUs per bodega, bodegas per sede)?
2. **Count methodology**: blind count vs. informed count — may our tool SHOW expected stock, or does that bias the count and disqualify the design?
3. **ERP handoff shape**: which ERP (only to shape the export), which columns/format make the digitador's job disappear?
4. **Environment**: connectivity inside bodegas (cold rooms, basements)? Offline-first needed? Noise level? Barcodes present on products?
5. **Users & devices**: exactly who counts, what devices are allowed in bodega?
6. **Units reality**: package hierarchies (caja→unidades, bulto→kg), lot/expiry tracking for perishables?
7. **Concurrency**: multiple counters in parallel? Recount/double-check flow on differences?
8. **Judging**: criteria weights, demo format, deliverables & deadline for final submission.
9. **AI constraints**: any restriction on cloud AI APIs handling Colsubsidio data?
10. **Anomaly bar**: what does "detects anomalies" need to look like to score — rule-based ok, or do they expect statistical modeling on the history?
