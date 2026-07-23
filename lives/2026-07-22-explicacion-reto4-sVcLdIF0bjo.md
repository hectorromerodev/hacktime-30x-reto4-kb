# Explicación Reto 4 · Hotelería — live segment analysis

Video: https://www.youtube.com/watch?v=sVcLdIF0bjo (segment 26:40–66:40)

Speaker identities are garbled by Whisper and are inferred from context, not stated cleanly on
the audio: the moderator/host is transcribed variably as "Andrea" / "André" / "Andrés"; the
Colsubsidio business owner presenting the reto is "Bibiana" (also addressed once as "Diana" —
possibly a second host or a transcription slip, flagged (?)); the inventory-process specialist who
joins later to answer detailed Q&A is transcribed "Mileni" / "Milenio" / "Mileny" (likely a
mis-transcribed "Milena" or similar, flagged (?)). None of this affects the substance below.

## How Colsubsidio framed the problem (anything beyond the written brief)

- **Pilot scope is narrower than "hotelería" sounds**: the reto is being explained purely from
  **Piscilago park's warehouses**, not hotels. Verbatim: *"El reto que tenemos por parte de la
  agencia de hotelería y turismo es hoy nosotros en los almacenes que tenemos en el parque, en
  este momento lo vamos a hablar solo para Piscilago, pero es un proyecto que si me funciona yo lo
  puedo pasar a los hoteles."* — i.e., Piscilago is the pilot; hotels are a future rollout target,
  not what's being demoed/judged now.
- **Concrete scale given for the pilot**: *"en el parque hoy tenemos 48 almacenes disponibles,
  donde cada uno tiene más de 1.407 artículos."* (~48 warehouses, each with 1,400+ articles/SKUs —
  flag (?) on the exact digit, spoken numbers are the riskiest thing for Whisper, but the order of
  magnitude reads clearly).
- **Current cost of the manual process**: *"El proceso se me demora más o menos dos días en la
  digitación."* — the handwriting→system re-entry step alone costs ~2 days per monthly cycle.
- **The canonical failure example, told twice, in almost the same words** — this is the anchor
  anomaly Colsubsidio wants caught:
  - Bibiana: *"puede que la persona que dijite entendió que había, no sé, 900, 900, 900 kilos de
    un material y eran 90 o viceversa."*
  - The moderator (Andrea), independently: *"mi 3 es muy parecido a un 5... yo puedo escribir un
    30 y resulta que otra persona [piensa] que es un 50."*
  Both examples are digit-transposition / handwriting-lookalike errors (9↔90, 3↔5 read as 30↔50) —
  this is *the* concrete failure mode judges will be listening for a solution to catch.
- **Colsubsidio's own team floated a voice agent as an example solution**, unprompted — this
  validates our approach rather than us having to sell it: *"podríamos tener algo como un agente
  [de voz], donde yo no tengo que confundir un 30 de Sandra con un 50, sino que directamente yo
  digo, hola, estoy registrando 50 toneladas de X cosas."*
- **The "counted vs. system" report is framed by the business owner as a core want, not a
  nice-to-have** — despite the written brief listing it as bonus, Bibiana's own list of what she
  wants from the reto ends with: *"que podamos tenernos algún reporte o algo que me permita sacar,
  cuánto subí y cuánto me cargó al sistema."* Worth treating as higher-value than "bonus" implies.
- **The catalog is far more than food**: beyond kitchen ingredients, Piscilago's warehouses also
  hold pool chemicals, animal-related supplies (it's a park with animals), medications, frozen
  goods, and internal service supplies/"menaje" (cutlery etc. tracked in the same system). Mileni:
  *"Todo, todo lo tenemos en el sistema y todo lo contamos."* — the product vocabulary a capture
  tool needs to disambiguate is heterogeneous, not just food SKUs.
- **Two parallel inventories exist**: raw materials, and "preparaciones realizadas" (recipe-made
  finished portions) — both get counted/weighed monthly. Open/started packages are weighed as
  partial product; finished prepared portions are counted separately as their own catalog article.

## Dataset & materials — everything said about what teams get

- Resources live on Colsubsidio's innovation platform, referenced twice with slightly different
  renderings: *"unioninnovacion.corsoxido.com"* and later *"innovacion.corsoxido.com"* — clearly
  the same site, "corsoxido" = Whisper's mangling of "Colsubsidio" (flag (?) on exact subdomain,
  read as **innovación.colsubsidio.com**).
- Path: enter the site → "reto de hotelería" section → problem info + a "recursos" tab → inside
  that, a **"bodegas y stock"** section with an **example inventory in Excel**, plus **a short
  tutorial on how to use the resources**.
- What's visible in the example, per the walkthrough: unit-of-measure values like *"unidades,
  kilogramos, etcétera, litros"* attached to products.
- This is described as **"un ejemplo de cómo es inventario"** — a single example/snapshot. Nothing
  in the transcript confirms it includes a multi-period historical series (contradicts nothing in
  our Q1, but doesn't confirm the "histórico de existencias" half of it either).
- A request for **actual paper-sheet images/examples of handwritten counts** was raised live and
  **not fulfilled in this segment** — the host says *"pueden preguntarle, a ver si podamos obtener
  un ejemplo de eso"* (i.e., they'll try to get one, not "here it is").
- The counting system in production is named **"My Inventory" (Oracle-based, flagged (?))** early
  on, and later described functionally by Mileni as an **"Inventory and Management"(?)** system —
  likely the same tool, imprecise transcription both times. A third, sharper data point on this:
  right after the "Myventory" exchange, someone asks a follow-up and the answer is *"Es symphony."*
  (line 176) — almost certainly **Oracle Simphony**, a real Oracle hospitality POS/inventory
  suite, not a Whisper hallucination. Read together, the three mentions ("My Inventory," "Inventory
  and Management," "Symphony") most plausibly describe **Oracle Simphony** (or an Oracle inventory
  module within it) as the actual backing system — worth confirming directly rather than assuming
  "My Inventory" was the real product name. This system auto-generates, per warehouse, the format
  listing every product + its unit of measure — that generated format is what's printed, handed to
  counters, filled in by hand, and later retyped into the app.

## Constraints, hints & preferences from the speakers

- **Devices**: personal phones/WhatsApp are explicitly **disallowed by Colsubsidio policy**;
  **tablets are allowed**. *"La idea es que no utilicen este tipo de dispositivos por políticas del
  Colsubsidio, pero pueden utilizar tablets."* — rules out a literal "count via WhatsApp bot"
  design for the in-warehouse capture step, even though voice/conversational capture as a *concept*
  is independently validated by the team (see above). A tablet-based app/PWA is the sanctioned form
  factor.
- **Connectivity is not guaranteed**: *"No todos los puntos de venta... no todos los que tienen
  inventario tienen red corporativa del Colsubsidio para poder conectarse si se necesita."* —
  offline-capable capture is a real requirement, not a speculative one.
- **Counting is deliberately blind**, for audit reasons, and this is stated explicitly: *"Se hace
  de manera ciega para asegurar que si yo tengo un inventario... teórico con unas cantidades... la
  persona que está contando cuente realmente lo que hay, no lo que el sistema está esperando."* A
  capture tool must not surface the system's expected quantity to the counter mid-count; anomaly
  flags belong after capture, matching the brief's "before saving" framing but implying the UI
  itself should stay blind during entry.
- **Partial/fractional counts are explicitly allowed**: *"¿Se permiten conteos parciales o
  fracciones como medio kilo, una caja y tres unidades sueltas?"* → *"Sí, sí se puede."*
- **Barcodes are not universal**: *"En el sistema no tenemos, si los tenemos clasificados para la
  compra, pero directamente dentro de la aplicación no todos los productos tienen un ID único...
  hay algunos que tienen un artículo y otros que no."* — barcode scanning cannot be relied on as
  the sole product-matching method; fuzzy name/voice matching against the catalog has to carry the
  load.
- **Product naming is homologated, but variants intentionally stay distinct** — this is the
  passage that speaks to the "recetas históricas" vs "registros históricos" ambiguity (see below):
  *"Nosotros tenemos un proceso, es en este sistema como hacemos una transformación de productos
  para manejar un modelo de recetas estándares. Entonces lo que hacemos es una homologación...
  Yo puedo tener 20 proveedores que me traen arroz, pero solamente en mi sistema cuento con un
  producto que se llama arroz... Yo puedo tener arroz, pero también puedo tener arroz doña pepa que
  se utiliza para unas preparaciones específicas que tienen un costo diferente."*
- **"Recetas" vs anomaly history — resolved, they are two different things.** The transcript never
  says "recetas históricas" or "registros históricos" verbatim, but it uses "receta"/"recetas" twice,
  both times meaning literal **cooking/production recipes** (raw ingredients → prepared portion),
  never "historical pattern of counts":
  1. *"manejar un modelo de recetas estándares"* — recipes as the basis for homologating many
     supplier SKUs into one catalog product (the arroz example above).
  2. *"todo lo que ya se ha preparado por receta en el sistema se convierte en un artículo
     terminado"* — recipes converting raw stock into finished/prepared portions.
  Both times, recipe-based tracking is explicitly waved off as **out of scope for this reto**: when
  asked about "pesaje por receta" (how much rice is left after some was used), the host answers
  *"Inicialmente no es como el objetivo del reto... es la siguiente parte de qué pasa después de
  que se utilizan las cosas."* So: **"recetas" = production/cooking recipes, explicitly out of
  scope** (consistent with the brief's kitchen-orders/recipes exclusion); **anomaly detection
  against a historical pattern is a separate, in-scope concept** the transcript gestures at only
  via the "saldos negativos y decimales raros" question (see Q&A), never naming it "registros
  históricos" either. There is no confusion to inherit from this transcript — the ambiguity, if it
  existed, came from elsewhere; here the two ideas are cleanly separate.
- Counting today proceeds by **physical location order + "grupos de familia"** (product family
  groups) rather than any digital "already counted" checklist: *"un orden estructurado dentro de
  los almacenes es donde está el inventario... todo se cuenta a través de grupos de familia."*

## Q&A — every question + answer in the hotelería block

| # | Question (paraphrased, Spanish) | Answer |
|---|---|---|
| 1 | ¿El inventario se lleva en un ERP/sistema interno? | Sí, hay un sistema que internamente lo lleva. |
| 2 | ¿Con qué regularidad se hace inventario? | Primero: "entre semana y mensual"; corrected later: *"la mayoría se hace mensual."* |
| 3 | ¿Qué sistema usan para su inventario? | *"Se está utilizando My Inventory de Oracle"* (?); a follow-up on the same topic gets *"Es symphony"* (line 176) — likely **Oracle Simphony**, an Oracle hospitality suite. |
| 4 | ¿Lo hace solo una persona o hay gente encargada por bodega? | Varias personas por bodega: una cuenta primero, otra hace el recuento. |
| 5 | ¿Se permiten conteos parciales/fracciones (medio kilo, caja + unidades sueltas)? | Sí, sí se puede. |
| 6 | ¿El personal usa teléfonos personales (WhatsApp) o dispositivos empresariales? | No se permiten dispositivos personales por política; **tablets sí están permitidas.** |
| 7 | (Jorge) ¿Qué pasa si dos operarios cuentan la misma bodega al mismo tiempo, y cuántas veces se repite eso? | Respuesta muy confusa/incoherente en el audio ("Mixto... algo argumentario, sí, si estamos dispuestos..."); efectivamente **no queda resuelta**. Se añade, aparte, que quieren que la solución se conecte con el inventario ya existente. |
| 8 | ¿Las unidades del inventario son PES, unidades completas y algo más? | No se enumeran verbalmente; se remite al ejemplo en el recurso Excel de la plataforma (muestra kilogramos, litros, etc.). |
| 9 | ¿Los conteos se hacen/harían manualmente? | Sí, se cuenta manualmente hoy; abierto a que el equipo proponga otra forma. Motivo del conteo: *"para controlar, para verificar que lo físico coincida con lo que está en el sistema."* |
| 10 | ¿Se maneja un estado de pérdida o merma en el inventario? | Sí, se maneja actualmente. |
| 11 | ¿Quieren una salida Excel/CSV con las mismas columnas del insumo? | Respuesta poco clara/entrecortada ("yo creería que sí, pero allí viví..."); **no queda confirmada.** |
| 12 | ¿Ven saldos negativos y decimales raros en Excel? ¿Qué pasa cuando algo no cuadra — cuáles son las diferencias normales? | Calificada como pregunta interesante que el propio equipo puede resolver dentro del proyecto (ejemplo: un "menos cinco" no debería existir); **se deja explícitamente a criterio del equipo, sin umbral ni modelo impuesto por Colsubsidio.** |
| 13 | ¿Quién puede mostrar las hojas de papel / ejemplos de textos escritos? | *"Pueden preguntarle, a ver si podamos obtener un ejemplo de eso"* — **no se entrega en vivo**, solo se promete el insumo de cómo se sube al ERP. |
| 14 | En el Excel, ¿había varios nombres para el mismo producto? | Sí hay homologación (20 proveedores de arroz → 1 producto "arroz" en el sistema), pero variantes reales para recetas distintas (ej. "arroz doña pepa") se mantienen como productos separados con costo distinto. |
| 15 | ¿Los productos en bodega tienen código de barras? | *"En el sistema no... si los tenemos clasificados para la compra, pero directamente dentro de la aplicación no todos los productos tienen un ID único"* — algunos sí, otros no. |
| 16 | ¿El inventario de producto ya abierto/parcialmente consumido se calcula? | Sí — manejan transformación de productos: inventario físico de materias primas + inventario de preparaciones realizadas; bolsas abiertas se pesan como producto, y las porciones preparadas se cuentan aparte como artículo propio. |
| 17 | ¿Qué condiciones de conectividad existen en las bodegas? ¿La solución debe estar conectada a internet? | *"No todos los puntos de venta... tienen red corporativa del Colsubsidio para poder conectarse si se necesita"* — conectividad no garantizada en todos lados. |
| 18 | (George) ¿Cómo se ve/recibe el inventario? ¿Es una imagen de la toma física o cómo sale del sistema? | El sistema ("Inventory and Management"(?)) genera un formato por almacén con productos + unidad de medida; ese formato se imprime, se llena a mano, y luego una persona distinta lo transcribe en la app — separación deliberada por auditoría. *"Se hace de manera ciega."* |
| 19 | ¿Cuántas personas intervienen en el proceso? | Depende del tamaño de bodega: almacén principal hasta 3 personas contando + 1 auditor, pero generalmente solo 2 (una cuenta, otra audita); para la digitación/ingreso, solo 1 persona — **"el líder de costos de cada negocio."** |
| 20 | ¿Se hace un cierre mientras se cuenta el inventario, o no se toca nada? ¿Es posible? | Sí — cierre físico ocurre horas después de la operación; el sistema también tiene su propio proceso de cierre; el inventario queda fechado al último día del mes. |
| 21 | ¿Tienen pesaje por receta (cuánto arroz queda en kilos/gramos tras usarse)? | Host: **no es el objetivo de este reto** (sería "la siguiente parte"), pero igual responden: las recetas convierten materia prima en "artículo terminado"; se cuenta por separado lo cerrado, lo iniciado/abierto (se pesa), y las porciones preparadas. |
| 22 | ¿Los productos se clasifican por código de barras o identificador interno? | Repite la respuesta de la pregunta 15: clasificados para compra, pero no todos con ID único dentro de la app. |
| 23 | Además de cocina, ¿qué otros destinos hay para los productos? | Servicios/insumos (menaje, cubiertos internos), químicos de piscinas, temas de animales del parque, medicamentos, alimentos congelados — *"todo, todo lo tenemos en el sistema y todo lo contamos."* |
| 24 | ¿Cómo saben que ya contaron algo — lo marcan de alguna forma? | Se cuenta por orden estructurado del almacén y por "grupos de familia" de producto; no hay un marcador digital descrito, la garantía viene del proceso de auditoría y el reconteo si aparece una novedad significativa. |

## General rules mentioned (applies to all retos)

- **Per-reto WhatsApp support groups exist** for follow-up questions across the hackathon —
  mentioned both closing out reto Crédito and opening/closing reto Hotelería: *"vamos a estar en el
  grupo de WhatsApp apoyándolos con todas las preguntas que tengan"*; *"tenemos grupos... reto de
  vivienda(?), reto de crédito, cada uno de los retos."*
- **Honesty commitment on data**: *"si no tenemos una data o no la vamos a utilizar, ahí también se
  lo vamos a decir, no se preocupen."* — if requested data can't be shared, teams will be told
  explicitly rather than left hanging.
- **Timeline stated once, generally**: *"todavía tenemos cuatro días completos para finalizar
  nuestros retos."*
- YouTube comments are also monitored live by the team as another answer channel, in parallel to
  the WhatsApp groups.

## Signals & reading between the lines

- The moderator independently proposing a **voice agent** as an example solution, twice using
  almost the same handwriting-confusion example Bibiana gave, suggests the judges already have a
  mental model of "voice/conversational capture solves this" — building toward that mental model
  directly (rather than pitching something orthogonal) is low-risk.
- **Tablets, not phones**, being the sanctioned device rules out literally using WhatsApp as the
  input channel for the counting step at Colsubsidio itself, even though "natural capture" per the
  brief doesn't require WhatsApp specifically — worth not over-indexing on WhatsApp-bot demos if we
  want the solution to read as "implementable as-is."
- The blind-count / two-person-audit process is a real institutional control, not an incidental
  detail — a design that reveals the system's expected quantity mid-count would visibly conflict
  with how Colsubsidio actually protects count integrity today, and could read badly to a judge who
  knows the process.
- Barcode absence being confirmed (not universal) removes a tempting shortcut — investing serious
  effort into barcode-scanning as a primary path is a wasted bet; text/voice fuzzy-matching against
  the catalog is the real crux to solve.
- The catalog's breadth (chemicals, animal supplies, meds, frozen goods, service items — not just
  food) raises the bar on "unambiguous recognition": a system tuned only for food-item vocabulary
  would miss a meaningful slice of Piscilago's real inventory.
- The "counted vs. system" report being close to the top of the business owner's own wish list
  (despite being scored as bonus per the written brief) suggests it's worth prioritizing over other
  bonus ideas if time is short.
- Today's "already counted" tracking is informal (physical order + family groups, no explicit
  digital flag) — a lightweight progress/completion view per warehouse/family-group would be a
  visible improvement over the status quo that costs little to build.
- The concurrent-counting question (two operators, same warehouse) getting an incoherent answer on
  air, twice unresolved, hints it may not be a scenario Colsubsidio has fully thought through
  themselves — safe to make a reasonable assumption (e.g., sequential family-group assignment) and
  state it rather than block on it.

## What still went unanswered

- Exact enumeration of unit codes ("PES", "unidades completas", "algo más") — deferred to the
  written Excel resource, never read aloud.
- Actual paper-sheet images/examples of handwritten counts — promised as a maybe, not delivered in
  this segment.
- Excel/CSV export column-level spec ("mismas columnas de insumo") — question asked, answer
  garbled/inconclusive.
- Two-operators-same-warehouse-simultaneously scenario — asked, answer incoherent, unresolved.
- Ambient noise conditions inside warehouses (voice-capture viability) — never raised in this
  segment.
- Evaluation criteria and weights specific to reto Hotelería — not covered before the segment moves
  into reto Seguros (only Seguros' criteria — modelo de propensión, funcionalidad, experiencia,
  innovación — are covered in this window, and only for that reto).
- Cloud AI API restrictions (Gemini, Claude, etc.) for real-world implementation — not discussed.
- Lot/expiry-date capture for perishables — not discussed.
- Any numeric tolerance/threshold for what counts as a "normal" difference during reconciliation —
  explicitly left open, to be solved by the team, not specified by Colsubsidio.

## Impact on our open questions (Q1–Q14)

| Q# | Status | What was said |
|---|---|---|
| Q1 | PARTIAL | Resources exist (Excel inventory example + short tutorial) on innovación.colsubsidio.com under "bodegas y stock" — but it's framed as one example/snapshot, not confirmed as a historical multi-period series. |
| Q2 | ANSWERED | Piscilago pilot: ~48 warehouses, each with 1,400+ (~1,407) articles — concrete pilot-scale number given. |
| Q3 | PARTIAL | Paper sheet pre-prints article name + unit; counter only fills in quantity (implies same-unit capture), but explicit box→units/bulto→kg conversion factors were never addressed. |
| Q4 | OPEN | Nothing said about lot/expiry-date capture. |
| Q5 | ANSWERED | Counting is explicitly "ciega" (blind) — the counter never sees the system's expected quantity, precisely to protect audit integrity. |
| Q6 | PARTIAL | Normally 2 people (1 counts, 1 audits/recounts, up to 3 + auditor in the main warehouse); 1 person ("líder de costos") enters data; recount triggered by a significant "novedad" — but the two-operators-same-warehouse-simultaneously edge case got an incoherent, unresolved answer. |
| Q7 | PARTIAL | The system (likely Oracle Simphony — "Es symphony," line 176) auto-generates a per-warehouse product+unit format (used for both paper handout and digitization) and an Excel example is provided via resources, but the direct CSV/Excel-export-columns question got a garbled, inconclusive answer. |
| Q8 | PARTIAL | Devices: personal phones/WhatsApp disallowed by policy, tablets allowed (clearly answered); profile: entry is done by "el líder de costos de cada negocio," no age/tech-familiarity detail given. |
| Q9 | ANSWERED | Not all points of sale/warehouses have Colsubsidio's corporate network — connectivity is not guaranteed, offline capability is a real need. |
| Q10 | OPEN | Nothing said about ambient noise in warehouses. |
| Q11 | ANSWERED | Not all products have a barcode/unique ID inside the counting app; some are classified for purchasing only — barcode can't be the sole ID method. |
| Q12 | OPEN | Evaluation criteria/weights were not covered for reto Hotelería in this segment (only covered for reto Seguros, later in the window). |
| Q13 | PARTIAL | The anomaly/threshold question ("saldos negativos, decimales raros") was explicitly left to the team to design and solve — no model or numeric threshold mandated by Colsubsidio. |
| Q14 | OPEN | Nothing said about cloud AI API restrictions. |
