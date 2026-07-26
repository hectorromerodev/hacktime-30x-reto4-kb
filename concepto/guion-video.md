# Guion del video · 2 minutos

Estructura de la charla *"Gana el mejor pitch"*: **20 / 20 / 50 / 10 / 20 segundos**.
Nadie se presenta al principio. Un solo flujo en el demo, no diez.

> **Antes de grabar, lee [la lista de comprobación](#lista-de-comprobación-antes-de-grabar).**
> Hay dos cosas que se graban **por separado** y una que puede no funcionar en tu red.

---

## 0:00 – 0:20 · El problema

**En pantalla:** nada de la app todavía. Tu cara, o una foto de una hoja de conteo en papel.

> «Cada fin de mes, en las bodegas del parque Piscilago de Colsubsidio, alguien cuenta
> producto por producto **en papel**. Ese papel viaja a otra persona, que lo digita en el
> sistema: **dos días de digitación**. Y una tercera lo revisa.
>
> Ahí es donde alguien cuenta nueve cajas y termina registrado noventa. Donde un tres se lee
> como un cinco. Donde los gramos se confunden con kilos.
>
> Ese error nadie lo ve hasta el cierre del mes.»

**Por qué así:** los "dos días" son dato de ellos, dicho en la sesión en vivo. El 9→90 es el
ejemplo que la dueña del proceso contó dos veces. Estás repitiendo su propio dolor con sus
palabras, no vendiendo una idea.

---

## 0:20 – 0:40 · Qué construimos

**En pantalla:** la app abierta en la lista de artículos, con el progreso a medias.

> «Construimos una app de tablet que captura el conteo en el momento.
>
> El contador elige el artículo **por voz, por escáner, por búsqueda o tocándolo**, escribe la
> cantidad, y listo. Lo que se cuenta entra limpio al sistema desde la primera vez.
>
> Con dos condiciones que nos puso Colsubsidio y que no se pueden romper: **funciona sin red**,
> porque no todas las bodegas tienen cobertura. Y **el conteo sigue siendo ciego** — la app
> jamás le muestra al contador cuánto espera el sistema.»

**No digas:** "usamos inteligencia artificial", "un modelo de lenguaje", "sintetizamos
histórico". Nada de eso es cierto en este producto y el jurado lo puede desmontar preguntando.

---

## 0:40 – 1:30 · El demo

**Un solo flujo.** Este es el momento que hay que clavar.

### 1 · El error del brief, muriendo en vivo *(≈20 s)*

**Toca:** `ACEITE` → teclea `900` → **Guardar**

Aparece:

```
⚠ Verificación de cantidad
900 litros está fuera de la escala habitual de ACEITE en esta bodega.
Cuenta otra vez para confirmar.

[ Volver a teclear ]   ← la acción principal
[ ¿Eran 90? ]
Si es correcto, indica por qué: …
```

> «Capturé novecientos. La app me detiene **antes de guardar** y me pregunta si eran noventa.
>
> Y fíjense en esto: **el sistema dice treinta con cincuenta y nueve litros, y ese número no
> apareció en ningún momento.** La app sabe en qué escala se mueve el artículo, no cuánto hay.
> El conteo sigue siendo ciego.»

**Toca:** `¿Eran 90?` → **Guardar**

> «Y si insisto en que son novecientos, tengo que decir por qué. Ese motivo queda registrado
> para el auditor.»

### 2 · Sin red *(≈20 s)*

**Antes:** activa el modo avión, o apaga el wifi.

**Toca:** cuenta dos o tres artículos seguidos.

> «Ahora estoy en modo avión. Sigo contando exactamente igual: se guarda al instante, sin
> esperar a nadie.»

**Señala la cabecera:** `Sin red · 3 por enviar`

**Vuelve a activar la red.** Espera a que el contador baje a cero.

> «Y al recuperar señal, sube solo. Reenviar el mismo lote no duplica nada, porque cada
> captura lleva su propia llave generada en la tablet.»

### 3 · Lo que recibe el líder de costos *(≈10 s)*

**Toca:** entra como **Bibiana Torres** → **Cierre**

> «Y esto es lo que la líder de costos pidió textualmente: **cuánto conté contra cuánto dice el
> sistema.** Con el archivo listo para cargar, con las mismas columnas de su propio formato.»

**Toca:** *Descargar Excel* — que se vea el archivo bajando.

---

## 1:30 – 1:40 · Por qué importa

**En pantalla:** tu cara, o el reporte de diferencias.

> «Todo el reconocimiento corre **dentro de la tablet**: ningún dato de inventario sale hacia
> un modelo de terceros. Por eso funciona sin red.
>
> Y es *human-in-the-loop*: la app marca, **la persona decide**, y cada vez que alguien ignora
> una alerta queda registrado por qué — para que el auditor pueda ajustar el umbral con datos.»

---

## 1:40 – 2:00 · Equipo y siguiente paso

> «Somos [nombres y roles].
>
> Lo que sigue no es una promesa: es un piloto en Piscilago **en el próximo cierre de mes**. Si
> funciona ahí, son las mismas 48 bodegas del parque, y después los hoteles.
>
> Una cosa que decimos de frente: **la voz necesita red.** Por eso nunca es el único camino —
> teclado, búsqueda y escáner funcionan sin señal. Preferimos decirlo a que se descubra en una
> bodega sin cobertura.»

**Por qué cerrar con una limitación:** en la charla de *human in the loop* lo dijeron literal —
declarar los límites conocidos «eso es ganador». Un jurado que conoce el proceso lo lee como
solidez, no como debilidad.

---

## Lista de comprobación antes de grabar

**Prepara los datos** (deja la bodega a medio contar):

```bash
pnpm --filter api demo
```

O usa la que ya está lista en producción:

```
https://conteo-inventarios.vercel.app/contar/cms0u81zq0001yfa8a41bslx6
```

- Entra como **Ana Gómez / 1111**. La bodega es **Kiosco Piscigiros AyB**: 56 artículos, 31 ya
  contados, así que la barra de progreso se ve a medias en vez de en cero.
- **ACEITE, AGUA 280 ML y AGUA BOTELLA están sin contar** a propósito, para contarlos en cámara.
- **Graba en Chrome.** En Safari el reconocimiento de voz falla.
- **Fuerza la recarga** (⌘⇧R) o usa pestaña privada, para que el service worker no te sirva una
  versión vieja.
- Cierra pestañas y notificaciones. Sube el brillo.

**Dos tomas separadas, no una:**

| Toma | Qué | Por qué |
|---|---|---|
| A | Anomalía + cierre + Excel | Necesita red |
| B | Modo avión | Necesita que NO haya red |

No intentes mostrar voz durante el segmento sin red: **no va a funcionar**, y no por un fallo
nuestro — el navegador manda el audio a servidores externos.

**La voz es opcional en este video.** Si en tu red funciona, mete una frase entre el punto 1 y
el 2: *«cinco kilos de harina»* y que se vea la tarjeta. Si no funciona, **no la fuerces**: el
demo se sostiene perfectamente sin ella y el guion ya explica por qué no es el único camino.

**Graba un MP4 de respaldo** aunque vayas a mostrar la URL en vivo. Lo recomendaron
explícitamente en la charla: *"graben el backup por si falla el wifi"*.

**Ensaya con cronómetro.** Dos minutos se pasan muy rápido, y el demo de 50 segundos es lo
primero que se desborda. Si te pasas, recorta del punto 3 (el cierre del líder), nunca del
punto 1.

---

## Lo que NO se dice

Cuatro frases que estuvieron en borradores y que **son falsas**:

| No decir | Por qué |
|---|---|
| *"sintetizamos histórico"* / *"5× el promedio de ayer"* | No hay histórico. El archivo es un corte único |
| *"un LLM respalda el emparejamiento"* | Es TypeScript sin dependencias, en el dispositivo |
| *"el contador dice 9 y la app corrige a 90"* | Va **al revés**: la app marca el **900** |
| *"el auditor firma en la app"* | Esa pantalla no existe |

Para las preguntas del jurado: [`preguntas-jurado.md`](preguntas-jurado.md).
