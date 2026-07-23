# Reto Crédito 1 — Crédito hiperpersonalizado (HACKTIME · Colsubsidio)

> Investigación de estado del arte para el build de 5 días (22–26 julio 2026).

## 1. Resumen del reto

Colsubsidio tiene datos que ningún banco tiene sobre sus afiliados (empleador, salario, composición del hogar, uso de subsidios y servicios), pero hoy les envía la misma oferta de crédito por los mismos canales. El reto: convertir ese conocimiento en propuestas de crédito relevantes, oportunas y percibidas como "hechas a mi medida" — la oferta correcta, a la persona correcta, en el momento y canal correctos.

---

## 2. Cinco aspectos de innovación

### Aspecto 1 — Motor Next-Best-Offer (NBO) con ML: decidir la oferta en tiempo real, no por campaña

**Qué es.** Un motor de decisión que, en cada interacción del afiliado (login a la app, uso de un servicio, redención de subsidio), evalúa su contexto completo y decide en milisegundos cuál es la mejor oferta de crédito — o si no hay que ofrecer nada. Es lo opuesto a la campaña masiva por segmentos precalculados: la decisión se toma en el momento del contacto, con datos vivos.

**Cómo lo haríamos.**
- *Datos que Colsubsidio ya tiene:* categoría de afiliación (A/B/C), salario e historial de aportes, empleador y antigüedad, composición del hogar (personas a cargo → cuota monetaria), uso de servicios (supermercados, droguerías, recreación, vivienda, educación), historial de créditos y pagos con la caja.
- *Modelo:* un ranker de propensión por producto (gradient boosting — XGBoost/LightGBM — sobre features del afiliado) + capa de reglas de elegibilidad (capacidad de descuento por libranza, ley de 50% de nómina) + lógica de supresión (rechazó la oferta ayer → no repetir hoy).
- *MVP 5 días:* dataset sintético de ~10k afiliados con perfiles realistas; modelo de propensión para 4–5 productos (libre inversión, libranza, educación, vivienda, compra de cartera); API REST (`POST /nbo` → oferta rankeada con explicación); demo UI que simula la app del afiliado mostrando ofertas distintas según el perfil que se seleccione.

**Pros.**
- Impacto directo en la métrica del reto: relevancia + oportunidad en una sola pieza.
- Arquitectura demostrable en 5 días con datos sintéticos; proveedores del sector (Fintilect/FICO) reportan hasta -50% costo de adquisición y +5–15% ingresos con hiperpersonalización — cifras de vendor, útiles como orden de magnitud, no como benchmark auditado.
- Reutilizable: el mismo motor rankea ofertas de crédito y de servicios de la caja.
- Según encuestas del sector (Fintilect), solo ~4% de los bancos escala hiperpersonalización hoy → espacio de diferenciación real para una caja.

**Contras / riesgos.**
- Sin datos reales de Colsubsidio, la demo depende de qué tan creíbles sean los sintéticos.
- Riesgo de sobre-oferta: presionar crédito a quien no lo necesita daña confianza (la caja tiene rol social, no solo comercial).
- Un modelo de propensión puro optimiza conversión, no bienestar del afiliado; hay que incluir restricciones de idoneidad (suitability).
- Producción real exige integración con core + gobernanza de modelos (SARC de la Superfinanciera exige modelos de riesgo documentados y auditables).

**Ejemplos reales.**
- **Nequi (Colombia):** duplicó clientes con créditos preaprobados usando ML sobre miles de micro-segmentos mensuales (alianza con AWS, Forbes 2025).
- **Evam NBX:** motor NBO event-driven para banca — decisión en milisegundos con memoria cross-channel (rechazo en cajero suprime la oferta en la app).
- **JPMorgan Chase:** US$18B en tecnología (2025) para orquestación personalizada de ofertas con IA/ML.

---

### Aspecto 2 — Scoring alternativo con los datos únicos de la caja

**Qué es.** Un score de crédito construido con datos que solo Colsubsidio posee — estabilidad de aportes de nómina, antigüedad laboral, comportamiento en servicios de la caja, puntualidad en pagos anteriores con Colsubsidio — para aprobar afiliados que Datacrédito rechazaría (sin historial o reportados). El "gota a gota" existe porque el score tradicional deja gente por fuera; la caja puede verla.

**Cómo lo haríamos.**
- *Datos:* serie de aportes mensuales (proxy de estabilidad de ingreso mejor que un extracto), rotación de empleadores, uso de subsidio de vivienda/educación (señal de proyecto de vida), pagos de créditos previos con la caja, tenencia de la Tarjeta Multiservicios. En fase 2: open finance (Decreto 1297/2022 + Decreto 0368/2026, que hace el sistema **obligatorio** y prohíbe cobrar por los datos) para traer cuentas y créditos de otras entidades con consentimiento.
- *Modelo:* regresión logística o gradient boosting binario (default/no default) entrenado sobre sintéticos; salida como score 0–1000 con razones (SHAP o coeficientes) para explicabilidad.
- *MVP 5 días:* score API + pantalla "por qué tu score es X" + caso demo: afiliado sin historial en centrales que la caja sí puede aprobar (comparación lado a lado score tradicional vs. score-caja).

**Pros.**
- Inclusión financiera medible: amplía la base aprobable sin subir el riesgo (los aportes de nómina son señal dura de ingreso).
- Ventaja competitiva estructural: ni bancos ni fintechs tienen los datos de subsidios y hogar de la caja.
- Alineado con la narrativa regulatoria colombiana (DNP y Superfinanciera publicaron guías pro scoring alternativo).
- La explicabilidad (razones del score) es diferenciador de demo y requisito regulatorio a la vez.

**Contras / riesgos.**
- **Habeas data (Ley 1581/2012):** usar datos recogidos para subsidios en decisiones de crédito requiere consentimiento para esa finalidad específica — no es automático.
- Sesgo algorítmico: features como composición del hogar o zona pueden actuar como proxies discriminatorios (género, estrato); la Circular SIC 002/2024 aplica a sistemas de IA con datos personales.
- Reformas en curso (proyectos de ley 214/2025 y 274/2025) agregarían el derecho a no ser objeto de decisiones puramente automatizadas → hay que diseñar con humano-en-el-loop desde ya.
- Validar un score de verdad requiere cosechas de default de 12+ meses; en hackathon solo se demuestra el mecanismo.

**Ejemplos reales.**
- **Nubank:** foundation models (nuFormer, tras adquirir Hyperplane) sobre trillones de transacciones para underwriting de clientes sin historial.
- **MONET, RapiCredit, Lineru (Colombia):** fintechs que prestan con scoring alternativo (pagos de servicios, comportamiento en apps) a reportados en Datacrédito.
- **RiskSeal:** scoring con huella digital para prestamistas en Colombia.
- **Datacrédito Experian:** ya explora open finance como fuente de datos alternativos para score.

---

### Aspecto 3 — Asesor de crédito conversacional con GenAI

**Qué es.** Un asistente conversacional (WhatsApp/app) que conoce el perfil del afiliado y conversa en lenguaje natural: "quiero arreglar la cocina", "¿me conviene comprar cartera?", "¿cuánto me prestan?". En lugar de un simulador de tabla de tasas, un asesor que traduce necesidad de vida → producto de crédito adecuado, con cuota simulada sobre el salario real del afiliado.

**Cómo lo haríamos.**
- *Datos:* perfil del afiliado (salario, categoría, créditos vigentes, capacidad de endeudamiento) inyectado como contexto; catálogo de productos de crédito Colsubsidio (tasas, montos, plazos, requisitos) como base RAG.
- *Tech:* LLM (Claude API) + RAG sobre el catálogo + function calling a la API de simulación de cuota y al motor NBO (aspecto 1) — el LLM conversa, el motor decide; el LLM **nunca** aprueba ni inventa condiciones.
- *MVP 5 días:* chat web o WhatsApp sandbox (Twilio) con 3 flujos guiados: "necesito plata para X", "explícame esta oferta", "¿puedo pagar esto?"; guardrails de alcance (no asesoría tributaria/legal, escalar a humano).

**Pros.**
- Máximo efecto "hecho a mi medida": la conversación es la personalización que el afiliado *siente*.
- Canal natural para la base de Colsubsidio (WhatsApp domina en el segmento; no exige aprender otra app).
- Demo de alto impacto para jurado con esfuerzo técnico moderado (el LLM hace el trabajo pesado).
- Recoge datos de intención ("para qué necesita la plata") que ningún formulario captura — alimenta los aspectos 1 y 4.

**Contras / riesgos.**
- Alucinaciones: prometer una tasa o aprobación inexistente tiene consecuencias legales (publicidad engañosa) — obliga a que toda cifra venga de function calls, no del modelo.
- Costo y latencia de LLM a escala de millones de afiliados (mitigable con modelos pequeños para intents comunes).
- Privacidad: la conversación contiene datos financieros sensibles; en WhatsApp intervienen terceros (Meta/BSP) — exige acuerdos de tratamiento de datos.
- Riesgo de empujar crédito conversacionalmente a población vulnerable; el asesor debe poder decir "no te conviene endeudarte".

**Ejemplos reales.**
- **Bank of America — Erica:** 42M+ usuarios, 2.000M+ interacciones; notificaciones y ofertas personalizadas.
- **Capital One — Eno:** asistente con alertas y gestión financiera personal proactiva.
- **Morgan Stanley:** asistente GPT-4 sobre su base de conocimiento para asesores patrimoniales (patrón RAG idéntico al propuesto).
- **Nequi:** IA generativa con AWS en servicio y personalización.

---

### Aspecto 4 — Triggers por eventos de vida: el momento correcto

**Qué es.** Detectar en los datos de la caja los eventos que crean necesidad real de crédito — nace un hijo (se registra para cuota monetaria), matrícula escolar, postulación a subsidio de vivienda, cambio o pérdida de empleo, vencimiento de un crédito — y disparar la oferta pertinente en horas, no en la próxima campaña trimestral. La industria muestra que el trigger accionado en <24h define si influye la decisión.

**Cómo lo haríamos.**
- *Datos/eventos que Colsubsidio ve antes que nadie:* alta de beneficiario (hijo nuevo), postulación a subsidio de vivienda (→ crédito hipotecario/complementario), temporada de matrículas (→ crédito educativo), retiro/cambio de empleador (→ compra de cartera o pausa preventiva), última cuota de un crédito (→ renovación), compras atípicas en supermercados de la caja.
- *Tech:* catálogo de eventos → reglas trigger→oferta (con ventanas de supresión y tope de contactos) + cola de eventos (bastan webhooks o un stream simulado en el MVP) que alimenta el motor NBO.
- *MVP 5 días:* simulador de línea de tiempo: se inyecta el evento "nuevo beneficiario registrado" y el panel muestra la notificación que recibiría el afiliado, con qué oferta, por qué canal y por qué. 4–5 eventos demo.

**Pros.**
- "Oportuno" es literalmente la palabra del reto; los triggers son la respuesta más directa.
- Benchmarks: ofertas por momento-de-necesidad superan consistentemente a campañas de calendario; casos publicados por proveedores (Prisma Campaigns / Financial Brand) reportan hasta +30% sobre metas de colocación — evidencia direccional, no auditada.
- Los eventos de la caja (nacimientos, matrículas, subsidio de vivienda) son señales que ningún banco recibe de primera mano.
- Complejidad técnica baja: reglas + eventos; no requiere ML para demostrar valor.

**Contras / riesgos.**
- Efecto "creepy": una oferta minutos después de registrar un hijo puede sentirse vigilancia, no servicio — calibrar tono y latencia (felicitar primero, ofrecer después).
- Un evento como pérdida de empleo es momento de *protección* (pausa de cuotas, subsidio de desempleo — Mecanismo de Protección al Cesante), no de venta; confundirlo destruye confianza.
- Finalidad de los datos: usar el registro de beneficiarios para marketing de crédito requiere consentimiento explícito (Ley 1581).
- Fatiga de contacto si varios triggers disparan a la vez — necesita orquestación y priorización (por eso se conecta al NBO).

**Ejemplos reales.**
- **Deluxe Life Event Triggers:** producto de triggers de eventos de vida para bancos de EE. UU. (mudanza, matrimonio, nacimiento).
- **Evam:** arquitectura event-driven donde el depósito de nómina o una transacción fallida cambian la decisión de oferta en el momento.
- **Bancos/cooperativas de EE. UU.:** triggers de crédito (cliente cotizó préstamo en otra entidad → contraoferta en <24h) vía burós.

---

### Aspecto 5 — Crédito embebido en el ecosistema Colsubsidio: el canal es el momento

**Qué es.** Llevar la oferta de crédito al punto exacto de la necesidad dentro del ecosistema físico y digital de la caja: cuotas sin tarjeta en la caja del supermercado Colsubsidio, financiación en la droguería para un tratamiento, plan de pago al cotizar vacaciones en un hotel de la caja, crédito educativo en el formulario de matrícula. El crédito deja de ser un producto que se busca y pasa a estar embebido donde ocurre el gasto.

**Cómo lo haríamos.**
- *Activos que Colsubsidio ya tiene:* red propia de supermercados, droguerías, hoteles, colegios y centros médicos + Tarjeta Multiservicios + cupo de crédito preaprobado por afiliado. Nadie más en Colombia tiene retail + crédito + datos del afiliado bajo una misma marca.
- *Tech:* API de "cupo disponible + oferta de cuotas" invocable desde cualquier punto de venta (`POST /checkout-offer` con afiliado + monto + categoría → plan de cuotas personalizado según capacidad de pago); el motor NBO decide si ofrecer y a qué plazo.
- *MVP 5 días:* demo de checkout (web) de un carrito de supermercado o plan turístico donde, al identificarse el afiliado, aparece "págalo a 6 cuotas de $X con tu cupo Colsubsidio" — con el plan calculado sobre su salario y endeudamiento sintéticos.

**Pros.**
- Contexto perfecto: la conversión en punto de necesidad supera cualquier campaña; BNPL en LatAm crece ~25% anual precisamente por esto.
- Aprovecha infraestructura física existente — ventaja imposible de copiar por fintechs.
- El dato transaccional del retail propio retroalimenta el score (aspecto 2) y los triggers (aspecto 4): círculo virtuoso.
- Monto pequeño y garantizable por libranza/cuota monetaria → riesgo acotado.

**Contras / riesgos.**
- Riesgo de sobreendeudamiento en montos pequeños y frecuentes (la crítica clásica al BNPL); requiere topes por categoría y visibilidad del endeudamiento total.
- Ofrecer cuotas para mercado básico a población de bajos ingresos tiene un dilema ético evidente para una entidad de compensación familiar — definir categorías elegibles (bienes durables, educación, salud sí; consumo básico recurrente, con cuidado).
- Integración real con POS y core es un proyecto largo; el hackathon solo demuestra la experiencia.
- Regulatorio: originación en punto de venta sigue exigiendo información precontractual clara (tasas, TEA) — la UX de "un clic" no exime de deberes de transparencia.

**Ejemplos reales.**
- **Addi (Colombia):** BNPL con ~2M clientes y 18.000+ comercios aliados; facilidad de crédito de US$100M (2024).
- **RappiPay / RappiBank (con Davivienda):** crédito y BNPL embebidos en la super-app; licencia de la Superfinanciera desde 2022.
- **Dock (LatAm):** infraestructura de "embedded credit" para que no-bancos presten en su checkout.
- **Falabella/CMR (regional):** el modelo retail+crédito propio que Colsubsidio puede replicar con ventaja de datos.

---

## 3. Stack sugerido para el hackathon (demo-able en 5 días)

**Recomendación: construir el aspecto 1 (NBO) como núcleo y colgarle 4 (triggers) + 3 (chat) como interfaces.** El 2 y el 5 se muestran como pantallas/casos dentro de la misma demo.

| Capa | Herramienta | Nota |
|---|---|---|
| Datos sintéticos | Script Python (Faker + distribuciones salariales DANE por categoría A/B/C) | ~10k afiliados: salario, hogar, aportes, uso de servicios, historial. Generarlo el día 1; es la base de todo |
| Modelo propensión/score | XGBoost o LightGBM + SHAP para explicaciones | Entrenar sobre etiquetas sintéticas; lo que se demuestra es el mecanismo y la explicabilidad |
| Motor de decisión | Servicio TypeScript (Bun + Hono) o Python (FastAPI): reglas de elegibilidad + ranking + supresión | Endpoint único `POST /nbo` que consumen chat, triggers y checkout |
| Eventos/triggers | Cola simple en memoria + panel de simulación de eventos | No hace falta Kafka para la demo |
| Asesor GenAI | Claude API + RAG (catálogo de productos en un JSON/embeddings) + function calling al simulador de cuota y al NBO | Cifras siempre desde tools, nunca del modelo |
| Demo UI | App web (Astro/React + Tailwind): vista "app del afiliado" + vista "panel Colsubsidio" (por qué se decidió cada oferta) | La vista de explicación es la que gana jurados |
| Deploy | Vercel/Cloudflare + demo en vivo con 3 personas sintéticas contrastadas (joven sin historial, madre categoría A, empleado por retirarse) | Guion de demo: mismo momento, tres ofertas distintas, cada una explicada |

---

## 4. Consideraciones regulatorias y éticas en Colombia

- **Habeas data (Ley 1581/2012, vigilada por la SIC):** los datos de afiliación se recogen para administrar subsidios; usarlos para perfilar ofertas de crédito es una **finalidad distinta** que exige autorización previa, expresa e informada. Diseñar el consentimiento granular (opt-in a "ofertas personalizadas") como parte del producto, no como letra pequeña.
- **Decisiones automatizadas y sesgo:** la Circular SIC 002/2024 aplica a sistemas de IA que traten datos personales (transparencia y proporcionalidad); los proyectos de ley 214/2025 y 274/2025 agregarían el derecho a no ser objeto de decisiones puramente automatizadas. Regla práctica: el modelo recomienda, un humano (o una regla auditable) aprueba; toda negación debe ser explicable; auditar el modelo por proxies de género/estrato/región.
- **Open finance:** Decreto 1297/2022 creó el marco voluntario; el Decreto 0368/2026 lo vuelve **obligatorio** para entidades vigiladas, con directorio de participantes en la Superfinanciera, APIs estandarizadas (CE 004/2024 y 009/2025) y prohibición de cobrar por los datos. Colsubsidio puede posicionarse como Tercero Receptor de Datos para enriquecer el score con consentimiento del afiliado.
- **SARC (Superfinanciera):** si la originación pasa por vigiladas o el volumen crece, los modelos de otorgamiento deben estar documentados, validados y ser auditables — otra razón para la explicabilidad desde el MVP.
- **Ética de caja de compensación:** Colsubsidio no es un banco; su mandato es bienestar familiar. El sistema debe poder recomendar *no endeudarse* (y decirlo), tratar eventos adversos (desempleo) como momentos de protección y no de venta, y poner topes de endeudamiento más conservadores que el mercado. Esto, bien contado, es un diferencial en el pitch, no una limitación.

---

## 5. Referencias

- https://evam.com/blog/next-best-offer-banking-ai — NBO en tiempo real, arquitectura event-driven (consultado)
- https://building.nubank.com/how-nubank-uses-causality-machine-learning-and-python-to-support-credit-limit-increase-decisions/ — Nubank: causalidad + ML en decisiones de cupo (consultado)
- https://building.nubank.com/unlocking-financial-insights-how-nubank-powers-personalized-experiences-with-foundation-models/ — Nubank: foundation models (nuFormer) para personalización
- https://forbes.co/2025/08/15/ia/nequi-ha-duplicado-clientes-con-creditos-preaprobados-implementando-ia — Nequi: IA duplica clientes con preaprobados (consultado)
- https://www.urf.gov.co/w/colombia-consolida-el-sistema-de-finanzas-abiertas-obligatorio — URF: Decreto 0368/2026, open finance obligatorio (consultado)
- https://www.suin-juriscol.gov.co/viewDocument.asp?id=30044474 — Decreto 1297 de 2022 (texto oficial)
- https://www.superfinanciera.gov.co/publicaciones/10116081/finanzas-abiertas-obligatorias-impulsaran-el-desarrollo-del-sistema-y-la-inclusion-financiera-en-el-pais/ — Superfinanciera sobre finanzas abiertas obligatorias
- https://www.suin-juriscol.gov.co/viewDocument.asp?id=1684507 — Ley 1581 de 2012 (texto oficial)
- https://resguard-solutions.com/blog/en/colombia-law-1581-data-protection-guide/ — Guía Ley 1581, Circular SIC 002/2024 y reformas 214/2025 y 274/2025
- https://colaboracion.dnp.gov.co/CDT/Prensa/Publicaciones/modelos-de-calificacion-crediticia-con-informacion-alternativa.pdf — DNP: scoring con información alternativa en Colombia
- https://www.monet.com.co/blog/scoring-alternativo/ — Scoring alternativo en fintechs colombianas
- https://www.pulzo.com/economia/como-funciona-scoring-alternativo-colombia-salva-reportados-datacredito-PP5138693 — Scoring alternativo para reportados en Datacrédito
- https://www.fintilect.com/resources/insights/hyper-personalization-ai-solutions-for-financial-institutions/ — Hiperpersonalización: adopción y ROI en banca
- https://www.fico.com/blogs/how-unlock-power-hyper-personalization — FICO: hiperpersonalización en banca
- https://masterofcode.com/blog/generative-ai-in-banking — GenAI en banca: Erica (BofA), Morgan Stanley, casos
- https://thefinancialbrand.com/news/bank-marketing/trigger-marketing-vs-batch-campaigns-195227 — Trigger marketing vs. campañas batch
- https://www.deluxe.com/data-driven-marketing/life-event-triggers/ — Life event triggers para marketing bancario
- https://resources.prismacampaigns.com/blog/high-performance-marketing-triggers — Resultados de triggers en instituciones financieras
- https://dock.tech/es/fluid/blog/cards-and-credit/embedded-credit/ — Embedded credit en América Latina
- https://fintech.global/2024/11/20/colombian-fintech-addi-secures-100m-credit-facility-from-victory-park-capital/ — Addi: BNPL colombiano
- https://www.colsubsidio.com/creditos/consumo/libre-inversion — Portafolio de crédito actual de Colsubsidio
- https://www.colsubsidio.com/empresas/bienestar/credito/libranza — Crédito de libranza Colsubsidio
