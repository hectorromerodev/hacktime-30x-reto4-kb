# Proceso de recepción de mercancía — answers from Colsubsidio

**Batch 1, received 2026-07-25.** Answers to the questionnaire we sent about what happens
*before* anything is ever counted: how product physically arrives at a bodega. Transcribed
verbatim (Spanish, as received, typos and all); the analysis below the fold is ours.

This is **upstream of Reto 04**. The challenge is *toma de inventarios*; reception is the
adjacent event. Nothing here changed the shipped app — it is recorded as validated context
and as the first item on the roadmap. Later batches append below; if a later answer
contradicts an earlier one, the later one wins.

---

## The answers

### 1. ¿Cómo llega el pedido físicamente?

> Llega directamente al almacén, cumplimiento con las características propias para la
> distribución de alimentos y para la entrega con una remisión o factura.

**¿El proveedor entrega directamente en cada almacén/bodega?**
> Llega al almacén principal del Hotel/Club o del Parque.

**¿O primero llega a un almacén principal y desde allí se distribuye a cada tienda o bodega?**
> Sí, llega primero al almacén principal y cada tienda o bodega realiza un pedido con los
> productos y cantidades de acuerdo con su necesidad en el sistema de inventarios.

### 2. ¿Quién recibe inicialmente el pedido?

> El almacenista o líder del almacén del Hotel/Club/Parque.

**¿Qué cargo o persona realiza la primera recepción?**
> Almacenista o Auxiliar de almacén.

**¿Siempre es la misma persona?**
> No, puede ser el almacenista o auxiliar de almacén.

### 3. ¿Cómo saben que ese pedido debía llegar?

> Existen unos tiempos definidos para realizar el pedido y de la misma días de entrega por
> parte de los proveedores.

**¿Existe una orden de compra?**
> Sí, la realiza el área experta de compras.

**¿Existe una solicitud previa?**
> Sí, se realiza un pedido.

**¿Quién la genera?**
> Almacenista o auxiliar almacén.

### 4. ¿Con qué documento llega el pedido?

> Remisión o factura.

| Documento | ¿Llega con él? | Razón dada |
|---|---|---|
| Factura | Sí | — |
| Remisión | Sí | — |
| Orden de despacho | No | — |
| Guía de transporte | No | *"porque no se identifica cantidades y productos"* |
| Otro | No | — |

### 5. ¿Ese documento es físico o digital?

> **Físico.**

### 6. ¿Qué información contiene normalmente ese documento?

NIT · Nombre del producto · Cantidad · Unidad de medida · Dirección · Fecha · Proveedor ·
NIT de Colsubsidio · **Número de remisión / número de orden de compra**.

---

## What it changes

**Confirms what we already built on.**

- *"No, puede ser el almacenista o auxiliar de almacén."* — the operator rotates. Same
  reality we assumed for counting, and the reason auth is **user + 4-digit PIN on a shared
  tablet** instead of a per-device login, and why every capture carries who registered it
  (traceability sheet of the export).
- *"Físico."* — the remisión is the same artifact class as the count sheet: paper that
  someone later types into a system. The problem the reto describes is not specific to
  counting; it is how the warehouse runs end to end.
- The three fields the paper carries — **nombre del producto, cantidad, unidad de medida** —
  are exactly the three our parser and matcher already resolve, on the same catalog.

**Adds to our model of the process.**

- **Two tiers, not one.** Proveedor → *almacén principal* del Hotel/Club/Parque → each
  tienda/bodega pulls what it needs *"en el sistema de inventarios"*. The 48 bodegas of the
  Excel hang off a main warehouse and move stock internally by request — which is a plain
  explanation for why 341 articles appear in two or more bodegas.
- **There is an expected quantity upstream.** Two documents exist before the truck arrives:
  an **orden de compra** issued by *"el área experta de compras"*, and a **pedido** raised by
  the almacenista or auxiliar. Plus defined ordering windows and supplier delivery days.
- Only the **remisión** and the **factura** carry line items. The guía de transporte was
  ruled out for a precise reason — *"no se identifica cantidades y productos"* — which is a
  usable rule, not an opinion.

**Does not change the shipped app.** Reto 04 is *captura en la toma de inventarios*, and we
are hours from the freeze. Adding a reception flow now would be scope creep against the
brief.

## Where it points (v2)

The same `packages/core` would serve a reception check without a rewrite: photograph the
remisión → extract the lines → match each against the catalog → compare against the orden de
compra → flag the difference **while the driver is still there**, instead of after the paper
is typed.

One design distinction worth stating out loud: **reception is not blind.** The count is blind
on purpose (audit — the person must count what is there, not what the system expects), but at
reception the remisión is physically in the receiver's hand. Showing the expected quantity is
correct there and wrong in the count. Same core, opposite rule.

## Still open

1. Does the remisión carry Colsubsidio's `Nr.Artículo`, or only the supplier's product name?
   (The list in Q6 says *nombre del producto*, not código.) If it is only the name, the fuzzy
   matcher is mandatory for reception, not a convenience.
2. Reception is against the **orden de compra** or against the **pedido**? Both exist.
3. What happens when less arrives than was ordered — who signs, where is the difference
   recorded?
4. Is the internal pedido (tienda → almacén principal) raised in the same system that
   generates the count format?
5. Volume: how many remisiones per day does a main warehouse receive?
