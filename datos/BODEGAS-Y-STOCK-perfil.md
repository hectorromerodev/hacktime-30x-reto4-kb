# Perfil — BODEGAS Y STOCK.xlsx

Generated 2026-07-23 by script (do not edit by hand; regenerate after file changes).
Official notes from organizers: `BODEGAS-Y-STOCK-notas-oficiales.md`.

## Sheet `BODEGAS DISPONIBLES` — 48 bodegas listed

- administracion  suministros piscilago
- aire libre suministros piscilago
- almacen general
- autoservicios cascada
- autoservicios las fuentes
- autoservicio mirador
- bodega de recreacion suministros
- cafeteria acuario suministros
- caf. Velas suministros
- cafeteria acuario suministros
- caf.velas
- cocina mirador suministros
- cocina principal suministros
- enfermeria suministros
- kiosco 2 suministros
- kiosco 3 suministros
- kiosco 1 piscilago
- kiosco 2 piscilago
- kiosco 3 piscilago
- kiosco bosque suministros
- kiosco bosques
- kiosco cascada suministros
- kiosco parqueadero piscilago
- kiosco paqueadero suministros piscilago
- movil 3 oasis suministros
- movil 4 taquilla suministros
- movil fonda suministros
- movil mirador suministros
- movil fonda
- movil mirador
- movil oasis
- movil taquilla
- panaderia
- panaderia suministros
- piscina suministros
- rest. Nutrias suministros
- restaurante cascada suministros
- rest. Fonda
- restaurante fonda suministros
- restaurante nutrias
- suministro aseo
- tienda general suministros
- tienda mirador suministros
- tienda principal suministros
- tienda taquilla suministros
- zoologico suministros
- zoologico piscilago
- Tienda souvenir pisciloca suministros

## Stock sheets

| Sheet | rows | units (dist) | SD: neg | SD=0 | SD decimal | decimal & Unidad | max SD | no Nr.Art | name-hygiene | dup names |
|---|---|---|---|---|---|---|---|---|---|---|
| STOCK ALMACEN  SUMINISTROS | 296 | Unidad:295 Kilogram:1 | 1 | 0 | 0 | 0 | 41500 | 6 | 25 | 0 |
| STOCK ALMACEN AYB | 270 | Kilogram:160 Unidad:65 Liter:39 Portion:6 | 11 | 0 | 78 | 0 | 28000 | 79 | 9 | 0 |
| STOCK RESTAURANTE FUENTES AYB | 344 | Kilogram:192 Unidad:91 Liter:47 Portion:14 | 46 | 0 | 193 | 9 | 20108 | 112 | 9 | 0 |
| STOCK RESTAURANTE FUENTES SUMIN | 133 | Unidad:133 | 2 | 0 | 6 | 6 | 26000 | 2 | 23 | 0 |
| STOCK KIOSCO TAQUILLA AYB | 58 | Unidad:43 Kilogram:13 Liter:1 Portion:1 | 6 | 0 | 14 | 1 | 810 | 21 | 3 | 0 |
| STOCK KIOSCO PISCIGIROS AYB | 56 | Unidad:43 Kilogram:11 Liter:1 Portion:1 | 13 | 0 | 11 | 0 | 1734 | 21 | 2 | 0 |
| ZOOLOGICO | 55 | Kilogram:53 Unidad:1 Liter:1 | 0 | 0 | 23 | 0 | 900 | 5 | 0 | 0 |
| ZOOLOGICO SUMINISTROS | 193 | Unidad:193 | 0 | 0 | 0 | 0 | 875 | 6 | 20 | 0 |

## Cross-bodega catalog

- **936 distinct article names** across all sheets; **1405 stock rows** total.
- **341 articles appear in ≥2 bodegas** (same catalog, per-bodega stock) — e.g.: ACEITE, ACEITE DE AJONJOLI, ACEITE DE OLIVA, ACEITE DE OLIVA 10ML /BOLSA SOBRE X50 UN, ACELGA, ACHIOTE MOLIDO, ADEREZO QUESO CHEDDAR, AFVT) ANTIMICROBIANO FRUTAS Y VERDURAS.

## Quirks that matter for the build

- `SD` = stock at cut date. Decimal values on `Unidad` items (see table) = the 'decimales raros' the business owner mentioned — anomaly-rule fuel.
- Missing `Nr.Artículo` on some rows → article NAME is the join key in practice; fuzzy matching mandatory.
- Name hygiene: leading/trailing spaces, non-breaking spaces (\xa0), double spaces, prefixes like `AFVT)` — normalize before matching.
- Units are English-ish (`Unidad`, `Liter`, `Kilogram`) — map to the spoken Spanish ('litros', 'kilos') in the voice layer.
- One header typo: `CANTIDA` (KIOSCO PISCIGIROS) — don't hard-code headers.
- `CANTIDAD` column is just a row counter, not data.
- Single snapshot: NO historical series → synthesize history for the anomaly-detection demo (validated as OK to ask in questions list).
