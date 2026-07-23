# Reto Seguros 2 — Venta automatizada de seguros (HACKTIME · Colsubsidio)

> Investigación de estado del arte — 21 de julio de 2026. Insumo para el build de 5 días (jul 22–26).

## 1. Resumen del reto

Hoy adquirir un seguro depende de un asesor humano que identifica la necesidad, cotiza, explica y cierra. El reto es construir un flujo donde el cliente pase de **"no sé qué necesito"** a **"ya quedé asegurado"** sin intervención humana: diagnóstico, recomendación, cotización, explicación, firma, pago y emisión de la póliza, todo automatizado.

**Contexto Colsubsidio:** la caja ya vende seguros de vida y accidentes personales (en convenio con MetLife) y tiene un ecosistema enorme de datos de momentos de vida (subsidios, crédito, vivienda, turismo, salud). Eso es una ventaja competitiva que ninguna insurtech genérica tiene — úsenla.

---

## 2. Cinco aspectos de innovación

### 2.1 Agente conversacional GenAI que diagnostica la necesidad ("el asesor digital")

**Qué es.** Un agente LLM que conversa en lenguaje natural (WhatsApp o web) y hace lo que hoy hace el asesor: preguntar por la vida del cliente (familia, ingresos, deudas, salud, bienes) y traducir eso a necesidades de aseguramiento concretas. Resuelve el punto de partida del reto: el cliente NO sabe qué necesita; el agente lo descubre por él.

**Cómo lo haríamos.**
- LLM (Claude/GPT) con un *system prompt* de asesor de seguros + herramientas (tool use): `perfil_cliente`, `catalogo_productos`, `cotizar`, `emitir`.
- Flujo: saludo → 5–8 preguntas adaptativas de momentos de vida (no un formulario: la conversación se ramifica según respuestas) → el agente arma un **perfil de riesgo estructurado** (JSON) → invoca el motor de recomendación (aspecto 2.2).
- Guardrails: el agente nunca inventa coberturas ni precios — solo lee del catálogo y de la API de cotización; disclaimers estándar; escalamiento a humano como *fallback* (para la demo, un botón "hablar con asesor").
- MVP 5 días: un solo ramo bien hecho (vida o accidentes personales, que ya vende Colsubsidio) + 2–3 productos en catálogo. La conversación completa de diagnóstico a recomendación es el corazón de la demo.

**Pros.**
- Ataca directamente el "no sé qué necesito" — es el diferenciador del reto, no solo un cotizador más.
- Lemonade demostró el modelo: Maya lleva de cotización a póliza emitida en ~90 segundos, 100% digital.
- La conversación genera datos ricos (contexto, dudas, objeciones) que retroalimentan producto y pricing.
- Demo-able y vistoso: un jurado lo entiende en 60 segundos.

**Contras / riesgos.**
- Alucinación = *mis-selling*: si el LLM promete una cobertura que no existe, es un problema regulatorio real (deber de información veraz, Ley 1328). Mitigación: el LLM solo parafrasea datos estructurados del catálogo.
- El "deber de asesoría" en seguros complejos (p. ej. previsionales) exige asesoría calificada — un bot puro puede no bastar legalmente en todos los ramos.
- Sesgo y tono: preguntas de salud/ingresos son sensibles; hay que diseñar la conversación con cuidado.
- Latencia y costo de tokens si la conversación es larga (controlable con buen diseño de prompts).

**Ejemplos reales.**
- **Lemonade (Maya)** — chatbot IA que cotiza, sub-escribe y emite pólizas en menos de 2 minutos; el caso canónico de venta 100% automatizada.
- **Ethos** — "conversational health interview": entrevista digital de salud que reemplaza el examen médico y emite vida a término en ~10 minutos.
- **Keebai / insurtechs LatAm** — operaciones completas de cotización-emisión sobre WhatsApp con IA; el proveedor reporta 70–80% de casos simples resueltos sin humano (cifra de vendor, no auditada).
- **Seguros Bolívar** — ya expone una IA de atención al cliente en su sitio; SURA vende por suraenlinea.com y WhatsApp.

---

### 2.2 Motor de recomendación y cotización instantánea

**Qué es.** El "cerebro" detrás del agente: recibe el perfil de riesgo estructurado y devuelve 2–3 productos rankeados con prima calculada al instante y una explicación del *porqué* de cada recomendación. Convierte el diagnóstico en oferta concreta comparable.

**Cómo lo haríamos.**
- Catálogo de productos como datos estructurados (JSON/YAML): ramo, coberturas, exclusiones, elegibilidad (edad, ocupación), tarifa base.
- Motor de recomendación por **reglas ponderadas** (edad, dependientes, deudas, bienes → puntaje de necesidad por ramo). Nada de ML entrenado en 5 días — reglas transparentes son además más defendibles regulatoriamente (explicabilidad).
- Tarifación: fórmula simple `prima = tasa_base × factor_edad × factor_suma_asegurada` expuesta como API mock (`POST /cotizar`). Respuesta < 1 segundo.
- Salida clave para la demo: tarjetas comparativas ("Plan A / B / C") con prima mensual, coberturas y **una frase de explicación generada** ("Te recomiendo vida porque tienes 2 hijos y un crédito hipotecario").
- MVP 5 días: 3–5 productos, 1 tabla de tarifas mock, endpoint de cotización.

**Pros.**
- El benchmark de mercado es <2 minutos de cotización (vs 24–48 h por canal tradicional en LatAm) — fácil de superar en demo.
- Reglas explicables = cumplimiento del deber de información y recomendaciones auditables.
- Separar agente (conversación) de motor (decisión) hace el sistema testeable y evita que el LLM "invente" primas.
- Escalable a más ramos con solo agregar entradas al catálogo.

**Contras / riesgos.**
- Tarifas mock ≠ tarifas actuariales reales; en producción requiere integración con el core de la aseguradora (PAS).
- Recomendación equivocada = mis-selling; hay que sesgar hacia sub-recomendar antes que sobre-vender.
- Reglas simples pueden ignorar casos borde (preexistencias, ocupaciones de riesgo) — resolver con preguntas de descarte (knock-out).
- Comparar solo 2–3 productos propios puede percibirse como poco neutral (los brokers digitales comparan multi-aseguradora).

**Ejemplos reales.**
- **123Seguro** — broker digital líder de LatAm (AR, BR, MX, CO, CL): comparación online multi-aseguradora + emisión digital.
- **Ladder** — cotización y decisión de cobertura de vida hasta USD $3M en minutos, ajustable ("ladder up/down") sin humano.
- **Transfiriendo (Colombia)** — plataforma que integra cotización, emisión, facturación y recaudo en un solo canal para aseguradoras y corredores.
- **Wibe (BBVA México)** — auto 100% digital y personalizable por cobertura (hoy absorbido por BBVA Seguros).

---

### 2.3 Underwriting y emisión automáticos (aceptación instantánea)

**Qué es.** La decisión de "¿te aseguro o no, y a qué precio?" tomada por software en segundos: preguntas de asegurabilidad + reglas de descarte + validación de identidad, con emisión inmediata de la póliza si pasa. Sin esto, el flujo automatizado se rompe justo antes del cierre ("un analista te contactará").

**Cómo lo haríamos.**
- **Underwriting simplificado por declaración**: 4–6 preguntas knock-out (edad, condiciones médicas graves, ocupación de riesgo). Sí a todas las sanas → aceptación instantánea; respuesta de riesgo → recargo automático de prima o derivación a humano (en demo: mensaje de "requiere revisión").
- **Onboarding "SARLAFT-lite"**: captura de cédula (foto + OCR mock o campo manual), validación de nombre contra número de documento, y un check simulado de listas restrictivas (función que siempre aprueba salvo un documento "semilla" de prueba — permite demostrar el caso de rechazo).
- **Emisión**: generación del PDF de la póliza (carátula + condiciones) con número único, enviado por el mismo canal (WhatsApp/email).
- MVP 5 días: motor de reglas en ~100 líneas de código + plantilla de póliza PDF. La magia es la percepción de instantaneidad.

**Pros.**
- Es lo que hace viable "sin intervención humana": Ethos pasó de semanas a 10 minutos eliminando el examen médico con datos declarados + fuentes externas.
- Reglas de descarte son el estándar de la industria para productos masivos/simples — no es ciencia ficción, es alcanzable en hackathon.
- La emisión inmediata del PDF cierra el loop emocional del cliente ("ya quedé asegurado" con documento en mano).
- Auditable: cada decisión queda registrada con las respuestas que la produjeron.

**Contras / riesgos.**
- Riesgo de antiselección: sin verificación externa (historia clínica, RUNT), la gente puede mentir; en producción se mitiga con cláusulas de reticencia (art. 1058 C. Co.) y verificación en siniestro.
- SARLAFT real exige más que un check simulado; el onboarding digital de conocimiento del cliente tiene requisitos de la Superfinanciera.
- Rechazos automáticos opacos pueden ser discriminatorios — cada rechazo debe tener razón explicable.
- Solo funciona para ramos simples y sumas moderadas; sumas altas siempre van a requerir underwriting humano.

**Ejemplos reales.**
- **Ethos** — underwriting predictivo instantáneo con historial de prescripciones y registros de conducción; el referente de vida a término 100% digital en EE. UU.
- **Ladder** — underwriting acelerado 100% digital con fuentes de datos de terceros, decisión en minutos.
- **Lemonade** — "customer cortex": ML sobre datos internos/externos para riesgo, pricing y disponibilidad en tiempo real.
- **Klimber (Argentina/LatAm)** — insurtech de vida con emisión digital simplificada, listada entre las 10 insurtechs a seguir en 2026.

---

### 2.4 Cierre 100% digital: firma electrónica + pago + póliza en el chat

**Qué es.** El último kilómetro: consentimiento informado, aceptación de condiciones, firma electrónica y pago de la primera prima sin salir del canal. Es donde la mayoría de flujos digitales de seguros en Colombia todavía se caen ("te llamamos para cerrar").

**Cómo lo haríamos.**
- **Consentimiento y transparencia**: antes de firmar, el agente muestra resumen de coberturas, exclusiones principales, prima, derecho de retracto y tratamiento de datos (Ley 1581) — checkbox explícito por cada uno. Esto no es burocracia: es el reemplazo digital del deber de asesoría y la defensa contra mis-selling.
- **Firma electrónica**: en Colombia la firma electrónica simple es válida (Ley 527 de 1999) — para el MVP: OTP a celular + aceptación con timestamp y hash del documento firmado (guardado como evidencia). No se necesita firma digital certificada para la demo.
- **Pago**: mock de PSE/tarjeta (pantalla de pago simulada que aprueba) o integración sandbox real si hay tiempo (Wompi/MercadoPago tienen sandbox en horas).
- **Entrega**: póliza PDF + certificado en el chat, con registro de entrega (los aseguradores deben probar que entregaron condiciones ANTES del perfeccionamiento).
- MVP 5 días: OTP simulado + pantalla de pago mock + PDF entregado en WhatsApp/web. Todo el flujo E2E en < 5 minutos cronometrados en vivo.

**Pros.**
- Cierra la promesa completa del reto: de "no sé" a póliza pagada y en mano, medible en minutos.
- La evidencia de firma + entrega de condiciones protege a la aseguradora contra desistimientos y disputas.
- Kushki, Wompi, MercadoPago y PSE hacen el pago digital de primas un problema resuelto en Colombia.
- Insurtechs LatAm (Keebai) reportan 18–30% de conversión cotización→emisión por WhatsApp — cifra de proveedor, pero útil como argumento de negocio en el pitch.

**Contras / riesgos.**
- Fricción real: cada pantalla de consentimiento reduce conversión; hay que equilibrar cumplimiento y UX.
- El pago recurrente (débito automático de prima mensual) es más difícil que el primer pago — no lo resuelvan en el hackathon, solo mencionenlo.
- La validez probatoria de la firma OTP depende de guardar bien la evidencia (hash, timestamp, IP) — fácil de hacer mal.
- Retracto y revocación (10 días hábiles en venta a distancia) deben estar en el flujo o es incumplimiento.

**Ejemplos reales.**
- **SURA (suraenlinea.com)** — compra de seguros 100% digital 24/7 en Colombia, con canal WhatsApp (315 275 7888).
- **Lemonade** — pago y emisión dentro del mismo chat, cero papeles.
- **eEvidence / Viafirma** — firma electrónica con evidencia probatoria específica para pólizas en mercado hispano.
- **Keebai (LatAm)** — flujo WhatsApp completo: OCR de documentos → emisión vía API del PAS → pago (Stripe/MercadoPago) → PDF de póliza en el chat.

---

### 2.5 Seguros embebidos en momentos de vida del ecosistema Colsubsidio

**Qué es.** En vez de esperar a que el cliente busque un seguro, el seguro aparece embebido en el momento exacto en que la necesidad nace dentro del ecosistema de la caja: al desembolsar un crédito → seguro de vida deudor; al comprar un plan de turismo → seguro de viaje; al recibir subsidio de vivienda → seguro de hogar; al nacer un hijo registrado como beneficiario → seguro educativo/vida. El trigger es el dato que Colsubsidio ya tiene.

**Cómo lo haríamos.**
- Simular 3–4 **eventos de momento de vida** (webhook mock: "crédito aprobado", "reserva de hotel Colsubsidio", "nuevo beneficiario registrado").
- Cada evento dispara una **oferta contextual pre-cotizada**: el agente conversacional (2.1) abre la conversación ya sabiendo el contexto ("Vi que reservaste 4 noches en Paipa con 2 niños — ¿aseguramos el viaje por $X?"). Un tap acepta; el flujo de cierre (2.4) remata.
- Pre-llenado total: la caja ya conoce identidad, ingresos (categoría de afiliación), familia — el cliente no repite datos. Esto colapsa el funnel a 2–3 pantallas.
- MVP 5 días: un dashboard "simulador de eventos" (para el jurado) + 2 journeys embebidos funcionando (p. ej. viaje y crédito).

**Pros.**
- Es la innovación más diferenciada del pitch: usa el activo único de Colsubsidio (millones de afiliados + datos de momentos de vida), no replicable por una insurtech externa.
- El seguro embebido es la gran apuesta de LatAm: estimaciones de la industria (100% Seguro / MPM) hablan de un mercado de USD $6.000M hoy, proyectado a ~25% de las ventas de seguros de la región en 2030 (30% anual 2025–2030) — proyecciones, no hechos.
- Conversión estructuralmente superior: la necesidad es evidente y el timing perfecto; CAC 30–50% menor que canales tradicionales.
- Pre-llenado = menos fricción = más cierre sin humano.

**Contras / riesgos.**
- Uso de datos del ecosistema para ofertas comerciales exige autorización previa de tratamiento (Ley 1581) — consentimiento granular, no letra pequeña.
- Riesgo de percepción invasiva ("¿cómo sabes que reservé hotel?") — el tono de la oferta importa tanto como el dato.
- Venta por "uso de red" y corresponsalía tiene ramos y condiciones regulados (Decreto 2555/2010, D. 2123/2018): la caja como canal debe operar bajo convenio con aseguradora vigilada.
- Opt-out fácil obligatorio; ofertas embebidas mal calibradas queman el canal para siempre.

**Ejemplos reales.**
- **Betterfly (Chile/LatAm)** — seguros de vida/salud embebidos en plataforma de beneficios de empleados, gamificado con hábitos saludables.
- **MetLife + Colsubsidio** — el convenio de seguros masivos ya existente: la base sobre la cual construir la versión digital embebida.
- **Tesla Insurance / aerolíneas** — seguro ofrecido dentro del flujo de compra del bien asegurado, referencia clásica de embedded.
- **Puntored, Chubb + retailers LatAm** — coberturas embebidas en retail, telcos y pagos, los verticales de mayor tracción en la región.

---

## 3. Stack sugerido para el hackathon (demo-able en 5 días)

| Capa | Elección | Nota |
|---|---|---|
| Agente LLM | Claude API (tool use) o GPT-4o | System prompt de asesor + 4 tools: `perfilar`, `recomendar`, `cotizar`, `emitir`. Guardrail: precios/coberturas SOLO desde el catálogo. |
| Backend | Bun + Hono (o Node/Express) | Un solo servicio. Endpoints: `/chat`, `/cotizar`, `/underwriting`, `/emitir`, `/webhook-evento`. |
| Catálogo + tarifas | JSON/YAML en repo | 3–5 productos, tabla de tarifas por edad/suma. Sin base de datos si no hace falta; SQLite si sí. |
| Motor de reglas | Función TypeScript pura | Reglas de recomendación + knock-out de underwriting, ~150 líneas, 100% testeable. |
| Canal | Web chat (fallback seguro) + WhatsApp si alcanza | WhatsApp Cloud API (Meta) tiene sandbox gratuito; si el aprovisionamiento se traba, la demo web ya cuenta la historia. Twilio Sandbox es plan B. |
| Firma | OTP simulado + hash SHA-256 del PDF + timestamp | Suficiente como "firma electrónica simple" conceptual (Ley 527). |
| Pago | Pantalla mock estilo PSE, o sandbox Wompi | Mock primero; sandbox real solo si sobra tiempo el día 4. |
| Póliza PDF | Plantilla HTML → PDF (puppeteer/`pdf-lib`) | Carátula con número de póliza, coberturas, prima, QR de verificación. |
| Demo del jurado | Dashboard de eventos (aspecto 2.5) + cronómetro en pantalla | Mostrar el E2E completo en < 5 min: evento → chat → recomendación → underwriting → firma → pago → PDF. |

**Reparto sugerido de los 5 días:** D1 catálogo + motor de reglas + esqueleto API · D2 agente conversacional con tools · D3 underwriting + emisión PDF · D4 cierre (firma/pago) + eventos embebidos · D5 pulido, guion de demo, pitch.

**Qué NO construir:** ML entrenado, integración real con core asegurador, pagos recurrentes, más de un ramo "profundo", app móvil nativa.

---

## 4. Consideraciones regulatorias y éticas en Colombia

- **Deber de asesoría e información (Ley 1328/2009 + EOSF):** el consumidor financiero tiene derecho a información clara, veraz, suficiente y oportuna. Un flujo automatizado debe reproducir la asesoría, no eliminarla: explicar coberturas Y exclusiones antes del pago, en lenguaje simple. El LLM jamás debe afirmar nada que no esté en el condicionado.
- **Mis-selling:** vender el producto equivocado por optimizar conversión es el riesgo #1 del reto. Diseño defensivo: recomendación explicable por reglas, sesgo a sub-vender, registro de toda la conversación como evidencia de qué se informó.
- **Canales de comercialización (D. 2555/2010, D. 2123/2018):** solo aseguradoras e intermediarios autorizados venden seguros; la comercialización masiva por uso de red/corresponsales está limitada a ciertos ramos (universales, estandarizados, simples). Colsubsidio opera vía convenio con aseguradora vigilada (como hoy con MetLife) — el bot es el canal, la aseguradora responde.
- **Venta a distancia y retracto:** el flujo digital debe garantizar la entrega comprobable del condicionado antes del perfeccionamiento y el derecho de retracto/revocación; guardar evidencia (hash + timestamp) de cada aceptación.
- **Datos personales (Ley 1581/2012):** autorización previa, expresa e informada para tratar datos — y una autorización separada para ofertas comerciales basadas en datos del ecosistema (aspecto 2.5). Datos de salud son datos sensibles: mínimo necesario, cifrados.
- **SARLAFT / conocimiento del cliente:** aun "lite", el onboarding digital debe contemplar identificación del tomador y verificación en listas; para seguros masivos de baja prima aplican regímenes simplificados.
- **Ética del agente:** no presionar (dark patterns), permitir salir del flujo en cualquier momento, escalar a humano a petición del usuario, y no discriminar en rechazos automáticos (toda negativa con razón explicable).

---

## 5. Referencias

Consultadas el 21 de julio de 2026:

- Keebai — Insurtech en WhatsApp: cotizar, emitir y atender pólizas con IA: https://keebai.com/blog/insurtech-whatsapp-cotizar-emitir-polizas
- Perspective AI — Lemonade / conversational AI case study: https://getperspective.ai/blog/lemonade-case-study-conversational-ai-insurance
- Perspective AI — Ethos: no-exam underwriting + conversational health interview: https://getperspective.ai/blog/ethos-ai-life-insurance-no-exam-underwriting-conversational-health-interview
- Rasa — Lemonade Maya AI Bot (showcase): https://rasa.community/showcase/lemonade-maya/
- Ethos — Ethos vs Ladder (underwriting digital comparado): https://www.ethos.com/life-insurance/ethos-vs-ladder-life/
- LatamFintech — 10 insurtechs a seguir en 2026 en América Latina (Klimber, Azos, 123Seguro…): https://www.latamfintech.co/listings/10-insurtechs-a-seguir-en-2026-en-america-latina
- 123Seguro — Nosotros: https://123seguro.com/about-123
- 100% Seguro — Seguros embebidos, la gran oportunidad de primaje en América Latina: https://100seguro.com.ar/los-seguros-embebidos-se-consolidan-como-la-gran-oportunidad-para-hacer-crecer-el-primaje-en-america-latina/
- MPM Software — Embedded insurance en LATAM: qué funciona y qué no: https://www.mpmsoftware.com/latam/blog/embedded-insurance-latam/
- URF — Documento técnico: Comercialización de seguros (D. 2123/2018): https://www.urf.gov.co/documents/283253/0/19.1+20181115+DT+Comercializacio%CC%81n+de+seguros+-+2123_2018.pdf
- Lexology — Novedades en la regulación colombiana de intermediarios y canales de comercialización de seguros: https://www.lexology.com/library/detail.aspx?g=91858bbb-8c40-4b5b-b499-43cdb9138267
- Fasecolda — Régimen de Seguros, Cap. 10.2 y 14 (comercialización y protección al consumidor): https://publicaciones.fasecolda.com/regimen-de-seguros/chapter/p2-c10-2/
- Secretaría del Senado — Ley 1328 de 2009 (texto vigente): http://www.secretariasenado.gov.co/senado/basedoc/ley_1328_2009.html
- Portafolio — Inteligencia artificial entra a la venta de seguros en Colombia (Transfiriendo): https://www.portafolio.co/tecnologia/inteligencia-artificial-entra-a-la-venta-de-seguros-en-colombia-con-nuevos-canales-digitales-integrados-495340
- SURA — Canal de venta digital / seguros en línea: https://www.sura.co/seguros/canales-venta/digital
- Seguros Bolívar — portal con asistente IA: https://www.segurosbolivar.com/
- Betterfly — plataforma de beneficios y seguros para equipos: https://betterfly.com/es-mx/plataforma-betterfly/
- BBVA México — ¿Qué pasó con Wibe? (seguro auto 100% digital absorbido por BBVA): https://www.bbva.mx/educacion-financiera/seguros/seguro-auto-que-paso-con-wibe.html
- Colsubsidio — Seguros (pólizas personales y familiares): https://www.colsubsidio.com/seguros
- MetLife — Convenio Colsubsidio (seguros masivos): https://www.metlife.com.co/seguros-masivos/colsubsidio/
- Kushki — Pagos digitales para aseguradoras: https://www.kushkipagos.com/blog-kushki-hub/pagos-digitales-un-aliado-para-la-industria-de-seguros
- eEvidence — Firma electrónica en seguros, pólizas entregadas con evidencia: https://blog.eevidence.com/es/firma-electronica-seguros-polizas-entregadas/
- Estudio Legal Hernández — Insurtech en Colombia, la nueva era de los seguros: https://estudiolegalhernandez.com/derecho-corporativo/insurtech-en-colombia-la-nueva-era-de-los-seguros
- Celent — Shedding Light on Agentic AI in Insurance: https://www.celent.com/en/insights/shedding-light-on-agentic-ai-in-insurance
- ScienceSoft — Q1 2026 Insurance AI Trends: https://www.scnsoft.com/insurance/insurance-ai-trends
