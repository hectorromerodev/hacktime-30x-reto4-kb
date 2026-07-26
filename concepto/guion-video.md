# Guion del video · 2 minutos — pitch + demo

Estructura de la charla *"Gana el mejor pitch"*: **20 / 20 / 55 / 8 / 17 segundos**.
Nadie se presenta al principio. Un solo flujo en el demo, no diez.

> Esta versión reemplaza a la anterior: incorpora el **rediseño con identidad Colsubsidio**
> y las dos piezas que llegaron después del primer guion — **merma con evidencia
> fotográfica** y el **panel del líder con cierre firmado**. El número de ROI y la versión
> palabra-por-palabra corta viven en [`guion-pitch-2min-y-roi.md`](guion-pitch-2min-y-roi.md);
> las defensas del Q&A en [`preguntas-jurado.md`](preguntas-jurado.md).

---

## El arsenal — qué es lo más fuerte y dónde se muestra

Dos minutos no aguantan diez features. Cada win tiene **un** lugar asignado: en cámara,
en una frase, o guardado para el README y el Q&A. Nada se pierde; nada estorba.

| # | Win | Por qué es fuerte | Dónde se muestra |
|---|-----|-------------------|------------------|
| 1 | **El 9→90 muere en cámara sin romper el conteo ciego** | Es *el* error del brief, y la solución (`exp10`: la tablet conoce el orden de magnitud, nunca la cantidad) es la decisión de diseño que nadie más va a tener | **Cámara** (beat 1) + Q&A |
| 2 | **Offline de verdad** | El wifi se apaga *en cámara* y se sigue contando; sync idempotente al volver. Condición dura de Colsubsidio, demostrada, no prometida | **Cámara** (beat 2) |
| 3 | **Merma con foto = diferencias EXPLICADAS** | Colsubsidio confirmó en vivo que la merma es parte del proceso. La columna "Sin explicar" convierte el reporte de una lista de descuadres en una explicación | **Cámara** (beat 3) |
| 4 | **Panel del líder + cierre firmado + export en su formato** | Es lo que la dueña del proceso pidió textualmente: contado contra sistema, sin descargar nada, y el archivo con sus propias columnas | **Cámara** (beat 4) |
| 5 | **Identidad Colsubsidio, pensada para la bodega** | Base clara porque contra el sol un fondo claro se lee mejor; contrastes medidos (WCAG), controles ≥44 px. El jurado la *ve* en cada toma — no se gasta ni una palabra en decirla | **Se ve sola**, todo el video |
| 6 | **Voz con dictado continuo** | El mic se reabre solo tras cada frase: se cuenta hablando, sin tocar | **Cámara si la red coopera** (beat 1); si no, teclado y el guion no cambia |
| 7 | **No es maqueta** | Desplegado, 86 tests unitarios y de API + 9 E2E, PWA en las tablets que ya tienen | **Una frase** en el cierre + README |
| 8 | **Ciego garantizado por arquitectura Y por rol** | `SD` nunca viaja a la tablet, y las rutas de reporte exigen rol LIDER (fuga verificada y tapada) | Q&A (bloque 2) |
| 9 | **Conflicto entre contadores: nunca se suma en silencio** | Dos personas cuentan lo mismo → queda en conflicto y el líder decide. Responde la pregunta 20 de Colsubsidio | Q&A + demo de finalistas |
| 10 | **Fuzzy match 99,4 % acc@5, <1 ms, sin red ni dependencias** | Es la respuesta a "¿dónde está la IA?": la que *sí* se puede desplegar en una bodega sin señal | Q&A (bloque 3) |

---

## 0:00 – 0:20 · El problema

**En pantalla:** nada de la app todavía. Tu cara, o una foto de una hoja de conteo en papel.

> «Cada fin de mes, en Piscilago, alguien teclea a mano **mil cuatrocientos cinco** renglones
> de inventario. Un **nueve** leído como **noventa** —y pasa— descuadra la bodega entera.
> Cuarenta y ocho bodegas, **dos días** de redigitación al mes. Y el error nace siempre en el
> mismo punto: cuando alguien captura lo que contó.»

**Por qué así:** los "dos días" y el 9→90 son datos de ellos, dichos en la sesión en vivo.
Estás repitiendo su propio dolor con sus palabras, no vendiendo una idea.

---

## 0:20 – 0:40 · Qué construimos

**En pantalla:** la app abierta en la lista de artículos de la bodega, progreso a medias
(38/56). La identidad Colsubsidio se presenta sola: no se menciona.

> «Por eso construimos **Conteo · Piscilago**: la tablet captura el conteo **en el piso**.
> El contador habla, teclea o escanea; la app **marca lo que no cuadra antes de guardar**; y
> todo entra limpio, listo para el sistema. Con dos condiciones que no se pueden romper:
> **funciona sin red**, y **el conteo sigue siendo ciego** — la app jamás muestra cuánto
> espera el sistema.»

**No digas:** "usamos inteligencia artificial", "un modelo de lenguaje", "sintetizamos
histórico". Nada de eso es cierto y el jurado lo desmonta con una repregunta.

---

## 0:40 – 1:35 · El demo — un solo recorrido, cuatro beats

Este es el momento que hay que clavar. Si el tiempo se desborda, se recorta el beat 3
y luego el 4 — **nunca** el 1.

### Beat 1 · El error del brief, muriendo en vivo *(≈20 s)*

**Con red todavía.** Si la voz coopera: toca el micrófono y di *«aceite… novecientos»*.
Si no: toca `ACEITE` y teclea `900`. → **Guardar**

Aparece el diálogo de banda amarilla:

```
⚠ Verificación de cantidad
900 litros está fuera de la escala habitual de ACEITE en esta bodega.
Cuenta otra vez para confirmar.

[ Volver a teclear ]   ← la acción principal
[ ¿Eran 90? ]
Si es correcto, indica por qué: …
```

> «Capturé novecientos. La app me detiene **antes de guardar**: novecientos se sale de la
> escala de este artículo. Y fíjense: **el sistema tiene treinta con cincuenta y nueve
> litros, y ese número no apareció en ningún momento.** La app conoce la escala, no la
> cantidad. El conteo sigue ciego. Solo pregunta: ¿no eran noventa?»

**Toca:** `¿Eran 90?` → **Guardar**

> «Noventa. **Un error de miles de pesos, muerto en dos segundos.** Y si insisto en
> novecientos, tengo que decir por qué — y ese motivo queda para el auditor.»

### Beat 2 · Sin red *(≈12 s)*

**Activa el modo avión** (en cámara, que se vea el gesto).

**Toca:** cuenta `AGUA 280 ML` y `AGUA BOTELLA` con el teclado.

> «Modo avión. Sigo contando igual: se guarda al instante. La cabecera lleva la cuenta de lo
> que está por enviar.»

**Señala la cabecera:** `Sin red · 2 por enviar` → **reactiva la red**, espera el cero.

> «Al volver la señal, sube solo — y reenviar el mismo lote no duplica nada.»

### Beat 3 · Merma con evidencia *(≈10 s)*

**Toca:** registrar merma en un artículo → motivo (p. ej. rotura) → **adjunta la foto**.

> «Dos botellas rotas: quedan como **merma, con su foto**. El descuadre deja de ser un
> misterio: es una diferencia **explicada, con evidencia**.»

### Beat 4 · Lo que ve la líder de costos *(≈13 s)*

**Cambia de sesión:** entra como **Bibiana Torres / 9999** → panel del líder →
pestaña **Diferencias** (que se vea la columna **Sin explicar** y la merma) →
**Cerrar conteo** → **Descargar Excel** (que se vea el archivo bajando).

> «Y la líder de costos lo revisa **sin descargar nada**: contado contra sistema, cuánto
> queda sin explicar, la merma con sus fotos. Cierra la auditoría — queda **firmada con su
> nombre y su hora** — y el archivo sale con las **columnas de su propio formato**.»

---

## 1:35 – 1:43 · Por qué importa

**En pantalla:** tu cara, o el reporte de diferencias.

> «Todo corre **dentro de la tablet**: ningún dato de inventario sale a un modelo de
> terceros. Por eso funciona sin red. Un agente de voz en la nube **no puede correr en esas
> bodegas** — esta es la IA que **sí se puede desplegar aquí**. Y es *human-in-the-loop*:
> la app marca, **la persona decide**, y cada excepción queda registrada con su motivo.»

---

## 1:43 – 2:00 · Equipo y siguiente paso

> «Somos **Hector Romero, Ayrton Santos, Gerardo Martinez y Rodrigo Sauceda**. Esto **no es
> una maqueta**: está desplegado, con ochenta y seis tests, y corre en las tablets que
> **ya tienen**, con el catálogo que **ya existe**. Siguiente paso: un **piloto en Piscilago
> el próximo cierre de mes**. Y una cosa de frente: **la voz necesita red** — por eso nunca
> es el único camino: teclado, búsqueda y escáner funcionan sin señal. Si funciona en
> Piscilago, funciona en **cada hotel y cada parque** de Colsubsidio.»

**Por qué cerrar con una limitación:** en la charla de *human in the loop* lo dijeron
literal — declarar los límites conocidos «eso es ganador».

---

## Lista de comprobación antes de grabar

**Prepara los datos** (idempotente; deja la bodega en 38/56 con anomalía confirmada,
conflicto entre dos contadores y métodos mezclados en TRAZABILIDAD):

```bash
pnpm --filter api demo
```

- Entra como **Ana Gómez / 1111** y elige **Kiosco Piscigiros AyB** desde la lista de
  bodegas — **no** uses una URL de conteo guardada: el seed borra y recrea el conteo, así
  que el ID cambia en cada siembra.
- **ACEITE, AGUA 280 ML y AGUA BOTELLA quedan sin contar** a propósito: son los del guion.
- ACEITE tiene stock **30,59 L** → teclear `900` dispara la verificación, seguro.
- **Graba en Chrome.** En Safari el reconocimiento de voz falla.
- **Fuerza la recarga** (⌘⇧R) o usa pestaña privada: el service worker puede servirte una
  versión vieja — y este video debe mostrar el **rediseño**, no la paleta anterior.
- **Encuadra como teléfono/tablet.** El rediseño es móvil primero; grabar en ventana de
  escritorio ancha desperdicia justo el trabajo que lo hace verse real. DevTools → modo
  dispositivo (Pixel 5 o iPad), o graba desde la tablet misma.
- Cierra pestañas y notificaciones. Sube el brillo.

**Dos tomas separadas, no una:**

| Toma | Qué | Por qué |
|---|---|---|
| A | Voz + anomalía + merma + panel del líder + cierre + Excel | Necesita red |
| B | Modo avión (beat 2) | Necesita que NO haya red |

No intentes voz durante el segmento sin red: **no va a funcionar** — el navegador manda el
audio a servidores externos. Primero la voz con wifi, después el modo avión.

**La voz es opcional.** Si en tu red funciona, el beat 1 se hace hablando y es más fuerte.
Si no, se teclea y el guion no cambia una palabra. La merma se registra tocando (el flujo
con foto está probado); no dependas de un comando de voz para ella.

**Graba un MP4 de respaldo** aunque vayas a mostrar la URL en vivo. Lo recomendaron
explícitamente en la charla: *"graben el backup por si falla el wifi"*.

**Ensaya con cronómetro.** El demo de 55 segundos es lo primero que se desborda. Si te
pasas, recorta el beat 3, luego el 4 — nunca el 1.

---

## Lo que NO se dice

Cuatro frases que estuvieron en borradores y que **son falsas**:

| No decir | Por qué |
|---|---|
| *"sintetizamos histórico"* / *"5× el promedio de ayer"* | No hay histórico. El archivo es un corte único |
| *"un LLM respalda el emparejamiento"* | Es TypeScript sin dependencias, en el dispositivo |
| *"el contador dice 9 y la app corrige a 90"* | Va **al revés**: la app marca el **900** |
| *"el auditor firma en la app"* | El **líder** cierra y firma; "auditor" es otro rol |

Para las preguntas del jurado: [`preguntas-jurado.md`](preguntas-jurado.md).
