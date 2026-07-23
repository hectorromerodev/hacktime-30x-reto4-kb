# Reto 04 · Hotelería — Captura inteligente en la toma de inventarios

Official text as published by Colsubsidio × 30X (verbatim, Spanish), followed by our parsed breakdown.

## Texto oficial

> ### El problema
>
> Cada fin de mes, en las bodegas de los hoteles y parques de Colsubsidio, el equipo de costos hace la toma física de inventario: bodega por bodega, cuenta producto por producto y va anotando lo encontrado en papel, una referencia a la vez. Ese papel viaja a otra persona, que lo digita en el sistema, y otra más lo revisa.
>
> El sistema interno ya sabe qué productos hay en cada bodega, sus unidades y cómo cuadran los costos. La parte más robusta del proceso ya está resuelta.
>
> El problema vive en el paso manual: cuando una persona captura lo que contó y otra tiene que transcribirlo. Ahí es donde alguien cuenta "9 cajas" y termina registrado como "90". Donde una caligrafía difícil se lee mal, donde una unidad se confunde con otra (gramos vs. kilos). Y donde después el inventario físico no cuadra con el del sistema.
>
> **Tu misión:** quitarle fricción y error a la toma física de inventario, para que lo que se cuenta entre limpio al sistema desde la primera vez.
>
> ### Cómo se ve un buen resultado
>
> No te decimos qué construir. Te decimos qué tendría que lograr una buena solución:
>
> - Reemplaza (o complementa) el "papel + digitar" con algo más natural: voz, conversación, o cualquier forma de captura que sea más rápida y menos propensa a error al contar.
> - Reconoce productos, cantidades y unidades sin ambigüedades. Si alguien dice "cinco kilos de harina", no lo confunde con cinco gramos.
> - Detecta anomalías antes de guardar. Si el patrón de esa bodega sugiere que normalmente hay 9 cajas y hoy alguien reporta 90, pregunta antes de dejarlo pasar.
> - Se apoya en el catálogo de productos que Colsubsidio ya tiene para validar cada conteo en tiempo real.
> - (Suma puntos) Genera reportes útiles: qué se contó vs. qué decía el sistema, dónde hay diferencias, dónde se repiten los descuadres.
>
> No importa si es un agente en WhatsApp, una app móvil, un widget web o algo que no se nos ocurrió. Eso es lo que queremos ver: tu forma de resolverlo.
>
> ### El dominio
>
> - **El error nace en el paso manual, no en el sistema.** Los ERPs de inventario que usa Colsubsidio son sólidos y ya conocen los productos, las bodegas y los costos. La oportunidad está en el frente: en el momento en que una persona tiene que capturar lo que contó.
> - **La toma física se repite bodega por bodega.** En los hoteles y parques hay varias bodegas, y en cada una se cuenta referencia por referencia. Una buena solución hace ese conteo más rápido y confiable en cualquier bodega.
> - **El catálogo e histórico de inventario son un activo.** Colsubsidio ya conoce sus productos, sus unidades y tiene histórico de existencias por bodega. Usar eso para validar en tiempo real es donde una capa de IA aporta mayor valor.
> - **El endpoint es información limpia lista para el ERP.** La solución no busca reemplazar el ERP; busca alimentarlo mejor.
>
> ### Qué NO toca este reto
>
> - Reemplazar el sistema actual de inventario.
> - Integración real con el ERP actual.
> - Compras a proveedores externos o pasarelas de pago.
> - Pedidos de cocina, recetas o menús.

## Parsed breakdown

### The one-sentence problem
A monthly physical inventory count flows **person counts → paper → second person types it in → third person reviews**, and every hop injects errors (9→90, bad handwriting, g vs. kg). The ERP side is fine; the capture step is broken.

### Hard requirements (a solution must…)
1. **Capture** faster and safer than paper+typing (voice/conversation/anything).
2. **Disambiguate** product + quantity + unit ("cinco kilos de harina" ≠ 5 g).
3. **Detect anomalies before saving**, using the bodega's historical pattern ("¿segura que son 90 cajas y no 9?").
4. **Validate in real time** against Colsubsidio's existing product catalog.

### Bonus points
5. Reports: counted vs. system, where the differences are, where discrepancies repeat.

### Explicit out of scope (don't burn time here)
- Replacing the ERP · real ERP integration · supplier purchases/payments · kitchen orders/recipes/menus.

### Implications we derived (validate in lives — see `research/questions-para-lives.md`)
- Output = a clean, ERP-ready dataset (think: importable file/table), **not** an API integration.
- The catalog + stock history are the fuel for validation and anomaly detection → we need (or must fabricate) realistic sample data. See `datos/`.
- Form factor is free (WhatsApp agent, mobile app, web widget) — judged on how well it kills the error, not the channel.
  **⚠ Superseded by the explicación live:** personal phones/WhatsApp are banned in bodegas by policy; **tablets are the sanctioned device**, offline support is required, and the count must stay blind. See `research/blind-spots.md` → "Hard design constraints".
- Multi-bodega repetition means the flow must be restartable/parallelizable per bodega, not a one-shot form.
