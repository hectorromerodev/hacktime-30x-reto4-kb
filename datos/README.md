# datos/ — raw assets from the organizers

Drop every file the organizers share (xlsx, PDFs, images) **directly in this folder**, keeping the original filename. Sizes up to a few MB are fine to commit as-is (no LFS needed under ~10 MB).

## Workflow: profile once, read the profile

Raw xlsx/PDFs are context-expensive for AI sessions and unreadable in diffs. So for every raw file we commit a companion **profile**:

```
datos/
  inventario-bodegas.xlsx          ← raw, untouched
  inventario-bodegas-perfil.md     ← generated: sheets, columns, row counts, sample rows, quirks
```

Rule for humans and AIs: **read the `-perfil.md`, only open the raw file when you need specific rows.** Ask Claude to "profile datos/<file>" after dropping anything new — it generates the profile with a script, not by reading the whole file into context.

## Current inventory

| File | From | Profile |
|---|---|---|
| *(pending — drop the organizers' xlsx here)* | | |
