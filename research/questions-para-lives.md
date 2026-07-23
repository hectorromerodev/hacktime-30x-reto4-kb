# Questions to ask in the lives / mentorías — Reto 4

Ready to paste in chat, in Spanish. Grouped by theme, ordered by how much a wrong guess would hurt us. *Why it matters* noted under each.

> **DRAFT** — prune before asking: the transcript of the "Explicación Reto Hotelería" segment (`lives/`) may already answer some. Never ask something they already answered on stream; it reads badly.

## 🥇 Datos (ask these first — everything downstream depends on them)

1. **¿Nos van a compartir un extracto (anonimizado) del catálogo de productos y del histórico de existencias por bodega, o debemos trabajar con datos sintéticos? ¿En qué formato?**
   *Why: real-time validation + anomaly detection — the two scored features — both feed on this data.*
2. **¿De qué tamaño es el problema: cuántas referencias maneja una bodega típica de hotel o parque, y cuántas bodegas tiene una sede?**
   *Why: UX for 80 SKUs ≠ UX for 3,000; sizing drives search/matching design.*
3. **¿El catálogo define unidad de medida estándar por producto y factores de conversión entre presentaciones (caja → unidades, bulto → kg)? ¿Quien cuenta lo hace en la misma unidad que registra el sistema?**
   *Why: "reconoce unidades sin ambigüedades" is a hard requirement; conversions are where it gets ugly.*
4. **¿En la toma física registran lote y fecha de vencimiento (perecederos de cocina), o solo cantidades?**
   *Why: doubles the capture payload if yes.*

## 🥈 Proceso actual

5. **¿El conteo es "a ciegas" (quien cuenta no ve el saldo del sistema) o puede verlo? ¿Una solución que muestre el stock esperado sesgaría el conteo — eso sería un problema de auditoría?**
   *Why: decides a core design fork — show expected qty vs. only flag anomalies after capture.*
6. **¿Cuántas personas cuentan en paralelo durante una toma, y qué pasa hoy cuando el físico no cuadra: recuentan? ¿Quién decide?**
   *Why: concurrency + discrepancy-resolution flow.*
7. **Sin pedir integración real: ¿qué formato de salida les dejaría el dato "listo para el ERP" — un archivo plano/Excel con qué columnas? ¿Qué ERP usan, solo para imitar su estructura?**
   *Why: the endpoint of the whole reto; nailing the export shape = "implementable" in judges' eyes.*
8. **¿Quién exactamente hace el conteo (perfil, edad, familiaridad con tecnología) y qué dispositivos están permitidos dentro de la bodega — celular personal, tablet corporativa?**
   *Why: WhatsApp-agent vs. dedicated-app decision hangs on this.*

## 🥉 Entorno físico

9. **¿Hay conectividad confiable (WiFi/datos) dentro de las bodegas — incluyendo cuartos fríos o sótanos — o necesitamos modo offline?**
   *Why: offline-first changes the architecture on day one, not day four.*
10. **¿Qué tanto ruido ambiente hay durante la toma (cocinas, motores de refrigeración)?**
    *Why: voice capture viability; may need push-to-talk / confirmation loops.*
11. **¿Los productos en bodega conservan código de barras legible, o hay mucho producto a granel / reempacado?**
    *Why: barcode scan could complement voice for the product-ID half of the problem.*

## 🏅 Evaluación y restricciones

12. **¿Cómo se evalúa la solución final: demo en vivo con un conteo simulado? ¿Cuáles son los criterios y sus pesos (funcionalidad, viabilidad de implementación, innovación, negocio)?**
    *Why: one podium for 4 retos — we need to know what moves the needle.*
13. **Para la detección de anomalías: ¿esperan un modelo sobre el histórico o basta una validación inteligente de umbrales bien fundamentada?**
    *Why: scoping the "IA" layer honestly; avoids over-engineering week.*
14. **¿Hay restricciones para procesar datos de inventario con APIs de IA en la nube (Gemini, Claude, etc.), pensando en la implementación real con Colsubsidio?**
    *Why: "pasa al plan de producto" — a compliance-blocked stack kills implementability.*

## Log

| Date | Live | Questions asked | Answered? → where logged |
|---|---|---|---|
| | | | |
