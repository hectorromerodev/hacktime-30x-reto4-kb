# TL;DR — HACKTIME Colsubsidio (índice + confianza)

> Resumen ejecutivo de las dos investigaciones. Cada sección tiene un puntaje de **confianza 1–5** (qué tan sólidas son sus fuentes y qué tan accionable es para el build del 22–26 de julio). Regla aplicada: toda sección que arrancó por debajo del umbral fue reforzada en el documento fuente hasta quedar en **≥ 4.5** — el log de refuerzos está al final.

---

## Reto 1 — Crédito hiperpersonalizado

**En una frase:** Colsubsidio ya tiene los datos (salario, empleador, hogar, uso de servicios); la innovación es decidir la oferta *en el momento de la interacción* (NBO), aprobar a quien Datacrédito no ve (scoring alternativo), conversar en vez de simular (asesor GenAI), disparar por eventos de vida (triggers) y llevar el crédito al punto de gasto de su propio retail (embebido).

**Recomendación de build:** NBO como núcleo + triggers y chat como interfaces; scoring y embebido como pantallas demo. Tres personas sintéticas, misma pantalla, tres ofertas distintas y explicadas — eso gana jurados.

**Pitch de producto:** [pitch-reto-1-credito.md](pitch-reto-1-credito.md) — el caso de valor (WHY), la tecnología (HOW) y los porqués, listo para convencer jurado/inversionistas.

### Índice — [reto-1-credito-hiperpersonalizado.md](reto-1-credito-hiperpersonalizado.md)

| Sección | Qué encuentras | Confianza | Por qué ese puntaje |
|---|---|:---:|---|
| 1. Resumen del reto | El problema en 3 líneas | **5.0** | Restatement directo del brief oficial |
| Aspecto 1 — Motor NBO con ML | Decisión de oferta en tiempo real por interacción; MVP con 10k afiliados sintéticos | **4.5** | Casos reales citados (Nequi/Forbes, Evam); cifras de ROI de vendors ya marcadas como direccionales |
| Aspecto 2 — Scoring alternativo | Score con aportes de nómina + hogar + servicios; aprueba a los invisibles para centrales | **4.5** | Regulación de fuente oficial (URF, Superfinanciera, DNP); ejemplos colombianos verificables (MONET, RapiCredit) |
| Aspecto 3 — Asesor GenAI | LLM + RAG + function calling; cifras solo desde tools | **4.5** | Patrón probado (Erica/BofA, Morgan Stanley); arquitectura estándar y demo-able |
| Aspecto 4 — Triggers por eventos de vida | Nuevo beneficiario, matrícula, subsidio vivienda, retiro → oferta en <24h | **4.5** | Mecanismo sólido y único de la caja; benchmark de vendor ya marcado como direccional |
| Aspecto 5 — Crédito embebido | Cuotas en checkout de supermercados/hoteles/droguerías propios vía API de cupo | **4.5** | Modelo probado en Colombia (Addi, RappiPay con cifras citadas); riesgo ético bien tratado |
| 3. Stack para el hackathon | Faker+DANE sintéticos, XGBoost+SHAP, Bun/Hono, Claude API, plan D1–D5 | **5.0** | Concreto, realista para 5 días, con reparto por día |
| 4. Regulatorio y ética | Ley 1581, Circular SIC 002/2024, open finance obligatorio (D. 0368/2026), SARC, ética de caja | **4.5** | Decretos y circulares de fuentes oficiales; proyectos de ley marcados como "en curso" |
| 5. Referencias | 22 URLs consultadas | **4.5** | Mezcla de fuentes oficiales, prensa y vendors — cada una usada según su peso |

---

## Reto 2 — Venta automatizada de seguros

**En una frase:** El asesor humano se descompone en 5 piezas automatizables: un agente GenAI que *descubre* la necesidad, un motor de reglas que recomienda y cotiza en <1s, underwriting knock-out con emisión instantánea de la póliza PDF, cierre con firma OTP (Ley 527) + pago en el chat, y —la carta diferencial— seguros embebidos en los momentos de vida del ecosistema Colsubsidio (crédito → vida deudor, turismo → viaje, nuevo hijo → educativo).

**Recomendación de build:** un solo ramo (vida o accidentes personales, que la caja ya vende con MetLife) hecho E2E completo, cronometrado en vivo en <5 minutos: evento → chat → recomendación → underwriting → firma → pago → PDF.

**Pitch de producto:** [pitch-reto-2-seguros.md](pitch-reto-2-seguros.md) — el caso de valor (WHY), la tecnología (HOW) y los porqués, listo para convencer jurado/inversionistas.

### Índice — [reto-2-venta-automatizada-seguros.md](reto-2-venta-automatizada-seguros.md)

| Sección | Qué encuentras | Confianza | Por qué ese puntaje |
|---|---|:---:|---|
| 1. Resumen del reto | El problema + contexto Colsubsidio (convenio MetLife existente) | **5.0** | Restatement del brief + hecho verificable (convenio citado) |
| 2.1 — Agente GenAI de diagnóstico | LLM con tools que reemplaza la entrevista del asesor; guardrail anti-alucinación | **4.5** | Casos canónicos (Lemonade Maya, Ethos); cifras de vendor ya marcadas como tales |
| 2.2 — Recomendación + cotización instantánea | Reglas ponderadas explicables sobre catálogo JSON; primas <1s con "porqué" | **4.5** | Diseño defendible regulatoriamente (explicabilidad); ejemplos reales (123Seguro, Ladder) |
| 2.3 — Underwriting y emisión automáticos | Knock-out questions + SARLAFT-lite + póliza PDF instantánea | **4.5** | Estándar de industria para ramos simples; claim no verificable (IPO de Ethos) retirado |
| 2.4 — Cierre 100% digital | Consentimiento granular, firma OTP con hash (Ley 527/1999), pago mock, entrega en chat | **4.5** | Base legal sólida (Ley 527, retracto); conversión de vendor marcada como tal |
| 2.5 — Seguros embebidos en momentos de vida | Triggers del ecosistema disparan ofertas pre-cotizadas y pre-llenadas | **4.5** | El activo único de la caja; proyecciones de mercado marcadas como estimaciones |
| 3. Stack para el hackathon | Claude tool-use, Bun+Hono, catálogo JSON, OTP+hash, PDF, plan D1–D5 y lista de "qué NO construir" | **5.0** | Concreto, alcanzable, con plan por día y anti-scope-creep explícito |
| 4. Regulatorio y ética | Ley 1328 (deber de asesoría), D. 2555/2010 + D. 2123/2018 (canales), retracto, Ley 1581, SARLAFT | **4.5** | Fuentes oficiales (URF, Fasecolda, Senado); mapea cada riesgo a mitigación de diseño |
| 5. Referencias | 26 URLs consultadas | **4.5** | Buena mezcla oficial/prensa/vendor, con la regulatoria de fuente primaria |

---

## Cómo leer los puntajes

- **5.0** — hecho directo o plan totalmente bajo nuestro control (brief, stack).
- **4.5** — bien sustentado en fuentes primarias o casos con nombre y cifra citable; los datos de vendors están explícitamente marcados como direccionales dentro del texto.
- Nada quedó por debajo de 4.5 (umbral exigido). Las secciones que arrancaron más abajo fueron reforzadas:

### Log de refuerzos aplicados (antes → después)

| Doc | Sección | Puntaje inicial | Problema | Refuerzo aplicado | Final |
|---|---|:---:|---|---|:---:|
| Reto 1 | Aspecto 1 (NBO) | 4.0 | ROI "-50% CAC / +5–15%" y "solo 4% de bancos" presentados como hechos, siendo cifras de vendor | Reetiquetados como cifras de proveedor / encuesta, orden de magnitud | **4.5** |
| Reto 1 | Aspecto 4 (Triggers) | 3.5 | "+30% sobre metas" citado como benchmark de industria | Marcado como caso publicado por proveedor, evidencia direccional no auditada | **4.5** |
| Reto 2 | 2.1 (Agente GenAI) | 4.0 | "70–80% sin humano" (Keebai) como hecho | Marcado como cifra de vendor no auditada | **4.5** |
| Reto 2 | 2.3 (Underwriting) | 3.5 | Afirmaba IPO de Ethos "(Nasdaq: LIFE, ene 2026)" — no verificable con las fuentes consultadas | Claim retirado; se conserva solo lo verificable (underwriting instantáneo, referente del sector) | **4.5** |
| Reto 2 | 2.4 (Cierre digital) | 4.0 | "Benchmark LatAm 18–30%" como dato de mercado | Atribuido explícitamente al proveedor (Keebai) | **4.5** |
| Reto 2 | 2.5 (Embebidos) | 4.0 | Mercado USD $6.000M / 25% en 2030 como hecho | Marcado como estimación/proyección de la industria con sus fuentes | **4.5** |

---

*Generado el 21 de julio de 2026 — listo para arrancar el 22.*
