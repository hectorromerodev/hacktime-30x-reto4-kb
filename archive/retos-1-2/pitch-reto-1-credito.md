# PITCH — "A Tu Medida": crédito hiperpersonalizado Colsubsidio

> Documento de pitch (Reto Crédito 1 · HACKTIME). Audiencia: jurado, directivos, potenciales patrocinadores.
> Investigación de soporte: [reto-1-credito-hiperpersonalizado.md](reto-1-credito-hiperpersonalizado.md)

---

## El pitch en 30 segundos

Colsubsidio sabe más de sus afiliados que cualquier banco de Colombia — dónde trabajan, cuánto ganan, cómo es su hogar, qué compran, qué sueñan (subsidio de vivienda, matrícula, un hijo nuevo). Y aun así hoy les manda **la misma oferta de crédito, por el mismo canal, a todos**. Nosotros convertimos ese conocimiento dormido en un motor de decisión que entrega **la oferta correcta, a la persona correcta, en el momento exacto en que la necesita** — y que también sabe cuándo NO ofrecer. Eso no es un chatbot más: es la infraestructura de personalización de toda la caja.

---

## 1. El problema (y por qué duele)

- **Para el afiliado:** recibe ofertas genéricas que no le sirven, en momentos que no le sirven. Cuando de verdad necesita crédito (matrícula, emergencia, vivienda), la caja no aparece — y el "gota a gota" sí. Colombia tiene millones de personas invisibles para las centrales de riesgo que un score tradicional rechaza automáticamente.
- **Para Colsubsidio:** campañas masivas por segmento = conversión baja, costo de contacto alto, y su activo más valioso (los datos del afiliado) generando cero diferenciación. Cada crédito que el afiliado toma en otra parte es margen y relación que la caja regala.
- **El dato que lo resume:** según encuestas del sector, solo ~4% de las instituciones financieras escala hoy la hiperpersonalización. El que llegue primero en el segmento de cajas, se queda con la categoría.

## 2. La solución

**"A Tu Medida"** — un motor Next-Best-Offer (NBO) en tiempo real, con tres caras visibles:

1. **Decisión en el momento** — cada interacción del afiliado (login, compra, trámite) pasa por el motor: ¿cuál oferta, por qué canal, o ninguna?
2. **Score de la caja** — aprueba con los datos que solo Colsubsidio tiene (estabilidad de aportes de nómina, antigüedad, hogar) a afiliados que Datacrédito no ve.
3. **Asesor conversacional** — el afiliado dice "quiero arreglar la cocina" en WhatsApp y recibe una propuesta concreta con cuota calculada sobre SU salario, explicada en lenguaje humano.

Y una regla de oro que ningún banco puede copiar sin sonar falso: **el sistema puede recomendar no endeudarse.** Colsubsidio es una caja de compensación — su producto es bienestar, y eso vende más confianza que cualquier tasa.

## 3. ¿Por qué esto realmente tiene VALOR?

### Para el afiliado
- Deja de ser "segmento C" y pasa a ser una persona: ofertas que coinciden con su vida real, cuando las necesita.
- **Inclusión financiera medible:** el score alternativo abre crédito formal a quienes hoy solo tienen el informal. Los aportes de nómina son una señal de ingreso más dura que un extracto bancario.
- Protección incorporada: eventos adversos (pérdida de empleo) disparan ayuda, no cobranza.

### Para Colsubsidio
- **Conversión:** las ofertas por momento-de-necesidad superan consistentemente a las campañas de calendario (casos de proveedores reportan hasta +30% sobre metas de colocación; Nequi duplicó clientes de preaprobados con ML). Aun capturando una fracción de eso, el ROI sobre una base de millones de afiliados es enorme.
- **Costo:** menos contactos irrelevantes = menor costo por colocación y menor fatiga del canal.
- **Moat de datos:** nómina + hogar + subsidios + retail propio bajo una sola marca. **Nadie más en Colombia tiene ese grafo de datos.** Un banco puede copiar el modelo; no puede copiar los datos.
- **Plataforma, no feature:** el mismo motor que rankea crédito rankea turismo, educación y vivienda mañana. Se construye una vez, monetiza todo el portafolio.

### Para quien invierte
- Mercado con viento de cola regulatorio: el Decreto 0368/2026 hace el open finance **obligatorio** en Colombia — los datos externos para enriquecer el score llegan por ley, con consentimiento y sin costo por los datos.
- Activo defendible + caso social demostrable (inclusión) = historia que funciona ante junta directiva, regulador y prensa a la vez.

## 4. ¿CÓMO lo construimos? (la tecnología)

```
Eventos de la caja ──► Cola de eventos ──► MOTOR NBO ◄── Perfil del afiliado
(beneficiario nuevo,                        │  1. elegibilidad (reglas: libranza, 50% nómina)
 matrícula, subsidio,                       │  2. propensión por producto (XGBoost + SHAP)
 login, compra retail)                      │  3. supresión y priorización (no repetir, no saturar)
                                            ▼
                              ┌─────────────┼──────────────┐
                              ▼             ▼              ▼
                        App/Push      Asesor GenAI     Checkout retail
                                   (Claude + RAG +     (API de cupo)
                                    function calling)
```

| Pieza | Tecnología | POR QUÉ esa elección |
|---|---|---|
| Motor de decisión | Servicio TypeScript (Bun + Hono), endpoint único `POST /nbo` | Un solo cerebro para todos los canales; auditable; latencia de milisegundos sin infraestructura pesada |
| Propensión y score | XGBoost/LightGBM + **SHAP** | Estándar de industria para datos tabulares; SHAP da la explicación de cada decisión — requisito SARC y argumento de venta ("por qué te ofrezco esto") |
| Asesor conversacional | Claude API + RAG sobre catálogo + function calling | El LLM conversa, el motor decide: **toda cifra sale de una tool, nunca del modelo** — cero alucinación de tasas |
| Eventos | Cola simple + catálogo trigger→oferta con ventanas de supresión | "Oportuno" es la palabra del reto; reglas + eventos entregan valor sin esperar a un ML perfecto |
| Datos (hackathon) | Dataset sintético ~10k afiliados (Faker + distribuciones DANE por categoría A/B/C) | Demuestra el mecanismo sin tocar datos reales — cero riesgo de habeas data en la demo |
| Demo | Vista "app del afiliado" + vista "panel Colsubsidio" (la explicación de cada decisión) | El jurado no ve un modelo: ve a 3 personas distintas recibir 3 ofertas distintas, cada una con su porqué |

**En producción** (post-hackathon): mismo diseño, reemplazando sintéticos por el data lake de la caja, cola real (eventos del core), y consentimiento granular como primer paso del onboarding.

## 5. Los WHYs

- **¿Por qué ahora?** (1) Open finance obligatorio desde el Decreto 0368/2026 — la ventana regulatoria está abierta hoy; (2) los LLM maduraron: la asesoría conversacional confiable ya es construible con guardrails; (3) solo ~4% del sector escala esto — ventaja de primer movimiento real.
- **¿Por qué Colsubsidio?** Porque el insumo escaso no es el modelo, son los datos — y la caja los tiene de primera mano: nómina, hogar, subsidios, retail. Además su mandato social le permite la única postura comercial que genera confianza: "también te digo cuándo no endeudarte".
- **¿Por qué esta tecnología?** Reglas + gradient boosting + SHAP es lo más simple que cumple SARC (explicabilidad) y lo bastante potente para personalizar. El LLM solo donde agrega valor (la conversación), nunca donde crea riesgo (la decisión).
- **¿Por qué ganamos?** Los demás equipos van a traer un chatbot o un dashboard. Nosotros traemos **la capa de decisión** que hace útil cualquier chatbot o dashboard — y la demo lo hace tangible en 60 segundos: tres afiliados, un mismo momento, tres ofertas distintas y explicadas.

## 6. Métricas de éxito (cómo se mide el valor)

| Métrica | Hoy (campaña masiva) | Objetivo con NBO |
|---|---|---|
| Conversión de oferta de crédito | Línea base de la caja | +20–30% (dirección validada por casos del sector) |
| Afiliados aprobables | Solo con historial en centrales | + segmento sin historial vía score-caja |
| Contactos irrelevantes por afiliado/mes | Todos reciben todo | Tope duro (supresión) — menos fatiga, más confianza |
| Explicabilidad | Caja negra / criterio de campaña | 100% de decisiones con razón auditable (SHAP + reglas) |

## 7. Riesgos y cómo los matamos

- **"Están usando datos de subsidios para vender crédito"** → Consentimiento granular opt-in como parte del producto (Ley 1581), no letra pequeña. La demo lo muestra explícitamente.
- **Sesgo algorítmico** → Auditoría de proxies (género/estrato/región), decisiones negativas siempre explicables, humano-en-el-loop para aprobaciones (alineado con Circular SIC 002/2024 y reformas en curso).
- **Sobreendeudamiento** → Restricciones de idoneidad dentro del motor: capacidad de pago real, topes conservadores, y la facultad de recomendar NO tomar el crédito.
- **"Es solo una demo con datos falsos"** → Cierto, y lo decimos: lo que se valida en el hackathon es el mecanismo y la arquitectura; el piloto con datos reales es el ask.

## 8. El ask

1. **Piloto de 90 días** con un segmento acotado (p. ej. crédito educativo en temporada de matrículas) y datos reales bajo consentimiento.
2. Acceso a un extracto anonimizado del data lake para calibrar el modelo de propensión.
3. Un sponsor de negocio (área de crédito) y uno de datos/legal para el diseño del consentimiento.

**Cierre:** la pregunta del reto es "¿cómo convertir ese conocimiento en propuestas hechas a la medida?" — la respuesta no es otra campaña. Es un motor que decide, explica y protege. Eso es "A Tu Medida".
