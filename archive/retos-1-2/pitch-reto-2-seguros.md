# PITCH — "Asegurado en 5 Minutos": venta 100% automatizada de seguros

> Documento de pitch (Reto Seguros 2 · HACKTIME). Audiencia: jurado, directivos, potenciales patrocinadores.
> Investigación de soporte: [reto-2-venta-automatizada-seguros.md](reto-2-venta-automatizada-seguros.md)

---

## El pitch en 30 segundos

Hoy, comprar un seguro en Colombia exige que un asesor humano te encuentre, te diagnostique, te cotice, te explique y te cierre — por eso la mayoría de los afiliados de Colsubsidio están subasegurados: el asesor nunca llega. Nosotros descomponemos al asesor en software: un agente conversacional que descubre qué necesitas, un motor que recomienda y cotiza en menos de un segundo, underwriting instantáneo, firma y pago en el mismo chat — y la póliza PDF en tu mano. **De "no sé qué necesito" a "ya quedé asegurado" en menos de 5 minutos, cronometrado en vivo.** Lemonade lo probó en EE. UU.; nadie lo ha hecho con el ecosistema de una caja de compensación.

---

## 1. El problema (y por qué duele)

- **Para el afiliado:** el seguro es el producto que todos necesitan y nadie compra — porque no sabe qué necesita, le da pereza el trámite, y desconfía de la letra pequeña. La consecuencia es real: familias de ingresos medios y bajos sin ninguna red de protección ante una muerte, un accidente o una hospitalización.
- **Para Colsubsidio:** ya tiene el convenio (MetLife), la marca de confianza y millones de afiliados — pero la venta depende de asesores humanos, que no escalan. El costo de venta asistida hace inviable vender pólizas de prima baja masivamente: exactamente las que su población necesita.
- **La brecha:** en canales tradicionales de LatAm una cotización tarda 24–48 horas. El estándar mundial ya es de minutos. Esa brecha es el negocio.

## 2. La solución

**"Asegurado en 5 Minutos"** — un pipeline de venta completamente automatizado, en el canal donde el afiliado ya vive (WhatsApp/web):

1. **Diagnóstico conversacional:** un agente GenAI hace 5–8 preguntas adaptativas de vida (familia, deudas, ingresos) y arma un perfil de riesgo — hace lo que hacía el asesor, sin agenda ni comisión que lo sesgue.
2. **Recomendación explicada:** 2–3 planes rankeados con prima al instante y el porqué en una frase: *"Te recomiendo vida porque tienes 2 hijos y un crédito hipotecario."*
3. **Underwriting y emisión instantáneos:** preguntas de asegurabilidad, validación de identidad, y la póliza PDF emitida al momento.
4. **Cierre en el chat:** consentimiento claro (coberturas Y exclusiones), firma electrónica OTP (válida por Ley 527 de 1999), pago, y documento entregado.
5. **El diferencial: seguros embebidos en momentos de vida.** La caja ve nacer la necesidad antes que nadie: crédito aprobado → vida deudor; reserva de hotel → seguro de viaje; hijo nuevo registrado → educativo. La oferta llega pre-cotizada y pre-llenada: dos taps y listo.

## 3. ¿Por qué esto realmente tiene VALOR?

### Para el afiliado
- Protección real a la que hoy no llega: sin citas, sin papeleo, sin vendedor insistente, en el canal que ya usa.
- Transparencia estructural: el flujo muestra exclusiones y derecho de retracto ANTES de pagar — más honesto que la venta presencial promedio.
- Pre-llenado con datos que la caja ya tiene = cero formularios repetidos.

### Para Colsubsidio
- **Escala sin nómina de ventas:** el costo marginal de vender una póliza más tiende a cero. Eso convierte en rentables las pólizas de prima baja — el grueso de su base.
- **Conversión estructuralmente superior:** insurtechs LatAm reportan 18–30% de conversión cotización→emisión por WhatsApp (cifra de proveedor, pero el orden de magnitud es 10x el canal frío). Y el embedded llega con la necesidad evidente y el timing perfecto.
- **Moat imposible de copiar:** una insurtech puede clonar el bot; no puede clonar los triggers del ecosistema (crédito, turismo, subsidios, beneficiarios) ni la confianza de marca de la caja. **El dato del momento de vida es el canal de distribución.**
- **Nueva línea de ingreso** sobre infraestructura existente: el convenio MetLife ya opera; esto lo multiplica.

### Para quien invierte
- El seguro embebido es la apuesta de la década en LatAm: estimaciones de la industria proyectan ~25% de las ventas de seguros de la región en 2030. Quien tenga los momentos de vida gana; Colsubsidio los tiene.
- Caso social + caso comercial en el mismo producto: cerrar la brecha de protección de las familias ES el negocio.

## 4. ¿CÓMO lo construimos? (la tecnología)

```
Momento de vida ──► Webhook ──► AGENTE GenAI (Claude + tools) ──► perfil de riesgo (JSON)
(crédito, viaje,                     │ solo conversa; nunca inventa precios       │
 nuevo beneficiario)                 ▼                                            ▼
                              catálogo JSON ◄── MOTOR reglas ponderadas ◄─────────┘
                                                │ recomendación + prima <1s + porqué
                                                ▼
                              UNDERWRITING (knock-out + SARLAFT-lite)
                                                ▼
                              CIERRE: consentimiento → firma OTP+hash → pago → PÓLIZA PDF en el chat
```

| Pieza | Tecnología | POR QUÉ esa elección |
|---|---|---|
| Agente conversacional | Claude API con tool use (`perfilar`, `recomendar`, `cotizar`, `emitir`) | La conversación es la única parte donde un LLM supera a un formulario; **guardrail duro: precios y coberturas SOLO desde el catálogo** — cero mis-selling por alucinación |
| Motor de recomendación | Reglas ponderadas en TypeScript puro (~150 líneas, 100% testeable) | Explicable = defendible ante Superfinanciera y auditable; nada de ML entrenado que nadie puede justificar |
| Underwriting | Preguntas knock-out + recargo automático + derivación a humano en casos de riesgo | Es el estándar de la industria para ramos masivos simples; hace posible el "sin intervención humana" sin fingir que todo es asegurable |
| Firma y evidencia | OTP + hash SHA-256 del PDF + timestamp | Firma electrónica simple válida (Ley 527/1999); la evidencia guardada es la defensa contra disputas |
| Pago | Mock PSE / sandbox Wompi | El pago digital de primas es problema resuelto en Colombia; no gastamos el hackathon ahí |
| Emisión | Plantilla HTML → PDF con número de póliza y QR de verificación | "Ya quedé asegurado" necesita un documento en la mano — cierra el loop emocional |
| Canal | Web chat (seguro) + WhatsApp Cloud API si el sandbox coopera | WhatsApp es donde vive el afiliado; la web demo cuenta la misma historia sin riesgo de demo fallida |
| Demo del jurado | Dashboard "simulador de eventos" + cronómetro en pantalla | El jurado VE el evento disparar la oferta y el E2E completo en <5 minutos medidos en vivo |

**Qué NO construimos (a propósito):** ML entrenado, integración real con el core asegurador, pagos recurrentes, multi-ramo profundo. Un ramo (vida o accidentes personales — el que ya vende la caja) hecho perfecto de punta a punta vale más que cinco a medias.

## 5. Los WHYs

- **¿Por qué ahora?** (1) Los LLM con tool use ya permiten diagnóstico conversacional confiable — hace 3 años esto era un árbol de decisión torpe; (2) la infraestructura colombiana está lista: firma electrónica válida, pagos digitales resueltos, venta digital de seguros ya operando (SURA en línea); (3) el embedded insurance está despegando en LatAm y las posiciones se toman ahora.
- **¿Por qué Colsubsidio?** Porque el problema de vender seguros no es la póliza, es la **distribución y el momento** — y la caja tiene ambos: millones de afiliados que confían en la marca y el dato del momento exacto en que nace cada necesidad. Lemonade tuvo que comprar tráfico; Colsubsidio ya lo tiene adentro.
- **¿Por qué esta tecnología?** Separar conversación (LLM) de decisión (reglas) es lo que hace el sistema seguro, auditable y regulatoriamente presentable. Cada elección técnica minimiza el riesgo #1 del reto: vender mal (mis-selling).
- **¿Por qué ganamos?** Porque el reto pide el viaje completo — "de no sé qué necesito a ya quedé asegurado" — y la mayoría mostrará solo el chat. Nosotros cronometramos el E2E en vivo: evento → conversación → recomendación → underwriting → firma → pago → póliza PDF. Un jurado no olvida un cronómetro.

## 6. Métricas de éxito (cómo se mide el valor)

| Métrica | Canal asistido hoy | Objetivo automatizado |
|---|---|---|
| Tiempo cotización→póliza | Días (24–48h solo la cotización) | **< 5 minutos** |
| Costo marginal por póliza vendida | Comisión + tiempo de asesor | ≈ costo de infraestructura (~centavos) |
| Conversión cotización→emisión | Línea base del canal actual | Referencia LatAm WhatsApp: 18–30% (vendor) |
| Cobertura de la base | Solo a quienes llega un asesor | 100% de afiliados digitales, 24/7 |
| Trazabilidad de la asesoría | Depende del asesor | 100%: toda conversación y consentimiento quedan registrados |

## 7. Riesgos y cómo los matamos

- **Mis-selling / "el bot me vendió lo que no necesito"** → recomendación por reglas explicables con sesgo a sub-vender; exclusiones mostradas antes del pago; toda la conversación registrada como evidencia del deber de información (Ley 1328).
- **"Un bot no puede vender seguros legalmente"** → la comercialización masiva digital de ramos simples está regulada y permitida (D. 2555/2010, D. 2123/2018); la caja opera como canal bajo convenio con aseguradora vigilada — exactamente como hoy con MetLife, pero digital.
- **Antiselección (la gente miente)** → knock-out questions + cláusula de reticencia (art. 1058 C. Co.) + verificación en siniestro, el mismo mecanismo que usa toda la industria en ramos masivos.
- **Percepción invasiva de las ofertas embebidas** → consentimiento granular previo (Ley 1581), tono de servicio ("¿aseguramos tu viaje?"), opt-out de un tap, y topes de frecuencia.
- **Se cae la demo en vivo** → web chat como canal primario (WhatsApp es bonus), datos y pagos mock deterministas, guion ensayado con cronómetro.

## 8. El ask

1. **Piloto de 90 días** en UN journey embebido de bajo riesgo: seguro de viaje en las reservas de hoteles Colsubsidio (necesidad evidente, prima baja, cero drama regulatorio).
2. Mesa técnica con MetLife (o la aseguradora del convenio) para conectar la emisión real vía API.
3. Sponsor legal/cumplimiento para validar el flujo de consentimiento, firma y retracto antes del piloto.

**Cierre:** el asesor humano no escala; la necesidad de protección de dos millones de familias, sí. La pregunta no es si la venta de seguros se automatiza — Lemonade y SURA ya lo hicieron — sino **quién la automatiza con los momentos de vida en la mano.** Solo Colsubsidio puede.
