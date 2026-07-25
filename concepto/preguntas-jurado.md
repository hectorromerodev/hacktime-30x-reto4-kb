# Preguntas del jurado — respuestas preparadas

Para los **3 minutos de Q&A** de finalistas (2 min de pitch + 3 de preguntas).

**Cómo usar esto:** cada pregunta trae una **respuesta corta** —eso es lo que se dice— y un
**si insisten** que solo se usa si el jurado profundiza. Responder de más es tan malo como
responder de menos: la charla de pitch dice que lo que diferencia es *"que sepa explicarme
cuando yo pregunto cosas"*, no que recite todo lo que sabe.

---

## Antes que nada: cuatro cosas que NO se dicen

Son afirmaciones que estuvieron en borradores del concepto y que **no son ciertas**. Un
jurado que conoce el proceso las desmonta con una repregunta.

| No decir | Por qué |
|---|---|
| *"sintetizamos histórico"* / *"5x el promedio de ayer"* | **No hay histórico.** El archivo es un corte único |
| *"un LLM respalda el emparejamiento"* | El matcher es TypeScript sin dependencias, en el dispositivo |
| *"el contador dice 9, la app corrige a 90"* | Va **al revés**: la app marca el **900** |
| *"el auditor firma en la app"* | Esa pantalla no existe |

Y una que sí se dice, en voz alta, porque **declarar una limitación suma**: *la voz necesita
red; por eso no es el único camino de captura.*

---

## Bloque 1 — Producto y alcance

### «¿Qué harían con tres meses y un equipo?»

**Corta:** *"Recepción de mercancía. Es el mismo núcleo con la regla opuesta: al recibir un
pedido **sí** hay que mostrar la cantidad esperada, porque estás verificando contra una
remisión. En el conteo mostrarla sería trampa. Mismo emparejador, mismo parser, misma cola
offline — cambia una regla."*

**Si insisten:** el papel que hoy firma el almacenista trae exactamente los tres campos que
ya parseamos: **nombre, cantidad y unidad de medida**. Después de eso: histórico real de
varios cierres para que las reglas dejen de apoyarse solo en la escala, y reconocimiento de
voz en el dispositivo con `vosk-model-small-es`, ~42 MB cacheados por el service worker.

### «¿Por qué no hicieron también la auditoría?»

**Corta:** *"Porque el reto pide captura, y la auditoría vive en otra aplicación. Lo que sí
hicimos es dejarle el insumo listo: la hoja de trazabilidad tiene quién capturó, cuándo, con
qué método, el texto literal que dictó y qué anomalía se disparó."*

### «¿Qué NO hicieron?»

**Corta:** *"Tres cosas, a propósito. No integramos el ERP —está fuera del alcance del reto—.
No tocamos recetas ni cocina. Y no hay pantalla para corregir una captura ya guardada: la
corrección vive dentro del diálogo de anomalía. Eso último no es una decisión de diseño, es
lo que no alcanzamos; es lo primero que construiríamos el lunes."*

> Esta respuesta desarma la pregunta trampa. La charla de human-in-the-loop lo dice literal:
> *"declara en el pitch las limitaciones y sesgos conocidos. Eso es ganador."*

---

## Bloque 2 — El conteo ciego (la pregunta de quien conoce el proceso)

### «¿Cómo detectan que 900 está mal sin mostrarle al contador cuánto espera el sistema?»

**Corta:** *"El dispositivo nunca recibe la cantidad. Recibe el **orden de magnitud**: sabe
que ese artículo anda en decenas, no sabe que son 30,59 litros. Con eso alcanza para detectar
que 900 está dos órdenes por encima, y no alcanza para copiar la respuesta."*

**Si insisten:** está garantizado por arquitectura, no por disciplina. La cantidad vive en
otra tabla y el endpoint del catálogo tiene un `select` explícito que no la pide. Hay una
prueba automatizada que **falla** si el campo aparece en cualquier respuesta que reciba la
tablet.

### «¿Y si el contador abre las herramientas del navegador?»

**Corta:** *"Aprendería 'esto suele estar en las decenas'. Nunca el número. Es un intercambio
deliberado: es lo que hace que la alerta funcione **sin red**, que es la condición normal en
las bodegas de Piscilago."*

**Si insisten:** la alternativa era no mandar nada y verificar solo al sincronizar — pero
entonces, sin señal, el contador guarda 900 y nadie se entera hasta horas después, cuando ya
salió de la bodega.

### «¿Un contador ve lo que contó el otro?»

**Corta:** *"No. El conteo es ciego dos veces: contra el sistema y **entre contadores**. Eso
último es justo el control que ustedes ya tienen —uno cuenta, otro recuenta— y romperlo
habría sido peor que no hacer nada."*

**Si insisten:** cuando dos personas cuentan el mismo artículo, la app avisa *quién* lo contó
pero **nunca cuánto**, y el artículo queda **en conflicto**: sin cantidad, hasta que el líder
decida si fue un recuento o dos ubicaciones distintas. No se suma solo.

---

## Bloque 3 — La IA (y por qué hay menos de la que esperan)

### «¿Dónde está la inteligencia artificial?»

**Corta:** *"En el emparejamiento por nombre, que es el problema real: ustedes nos dijeron que
no todos los productos tienen ID único. Sobre los 936 artículos reales acierta **94,3% exacto
y 99,4% entre los cinco primeros**, en una décima de milisegundo, y corre **en la tablet**."*

**Si insisten:** *"Y por eso ningún dato de inventario sale hacia un modelo de terceros. Eso
responde de paso una pregunta que quedó abierta en las sesiones: qué restricciones hay para
usar IA en la nube. Aquí no aplica."*

### «¿Por qué no usaron un modelo de lenguaje?»

**Corta:** *"Porque no funciona sin red, y la restricción que ustedes pusieron es que no todas
las bodegas tienen red corporativa. Un modelo en la nube habría hecho un demo más vistoso y un
producto que se cae en la primera bodega sin señal."*

**Si insisten:** el gancho está listo: cuando el parser local queda con baja confianza y hay
red, se puede consultar a Gemini pasándole los candidatos del catálogo. Está diseñado como
**mejora opcional**, nunca como dependencia. No lo conectamos porque no hacía falta para el
caso central.

### «¿Cómo sé que ese 94% es real y no un número inventado?»

**Corta:** *"Es reproducible: `node src/eval/evalFuzzy.ts` en el repo. Corre los 936 nombres
reales contra seis deformaciones —dictado parcial, typos, letras faltantes, orden invertido—
y saca el número delante de ustedes."*

**Si insisten:** el catálogo viene sucio del sistema origen y el motor está calibrado para
eso: **51 nombres truncados a 40 caracteres**, espacios no-rompibles en medio de las palabras,
**252 filas sin número de artículo**. Por eso la medida es asimétrica: mide cuánto de lo
dictado cubre el candidato, nunca al revés — al candidato le falta cola, no le sobra.

---

## Bloque 4 — Human-in-the-loop

### «¿Cómo evitan que la gente le dé aceptar sin pensar?»

**Corta:** *"Tres decisiones. La acción primaria del diálogo es **volver a teclear**, no
aceptar. Aceptar **exige elegir un motivo**. Y ese motivo queda registrado en la hoja de
trazabilidad, con nombre y hora."*

**Si insisten:** *"No pretendemos que la alerta nunca se equivoque: es una heurística, y quien
decide es la persona. Lo que sí garantizamos es que cada vez que alguien la ignora queda
registrado por qué — y eso le permite al auditor ajustar el umbral con datos, no con
intuición."*

> Esa última frase es la respuesta al sesgo de automatización. Si la pregunta viene por ahí,
> es la que hay que dar.

### «¿Y si la alerta se equivoca y frena a la gente?»

**Corta:** *"Se equivoca por diseño hacia el lado seguro. Preferimos preguntar de más que
dejar entrar un 900 al sistema. Y el umbral es de un orden de magnitud, no de un 10%: no
salta por un descuadre normal."*

---

## Bloque 5 — Viabilidad e implementación

### «¿Esto aguanta las 48 bodegas? ¿Y los hoteles?»

**Corta:** *"Sí, y no por optimismo: el emparejador tarda una décima de milisegundo con 936
artículos porque usa un índice invertido, no una comparación contra todo. Cada bodega
descarga solo su catálogo. Los hoteles son el mismo modelo con otro catálogo."*

### «¿Cuánto se ahorran realmente?»

**Corta:** *"Ustedes dijeron que la digitación sola toma unos dos días por ciclo. Eso
desaparece: lo capturado ya está en el sistema al terminar de contar. Pero el ahorro grande no
es el tiempo, es el error que hoy nadie detecta hasta el cierre."*

**Si insisten:** no prometemos un porcentaje de reducción de error, porque no tenemos con qué
medirlo todavía. Lo que sí se puede medir desde el primer cierre: cuántas veces saltó la
alerta y cuántas veces la persona corrigió. Eso sale del propio reporte.

### «¿Cómo lo instalan? ¿Va a la tienda de aplicaciones?»

**Corta:** *"No hace falta. Es una aplicación web instalable: se abre en el navegador de la
tablet y se agrega a la pantalla de inicio. Nada de tiendas, nada de MDM, y se actualiza sola."*

### «¿Un PIN de cuatro dígitos no es poca seguridad?»

**Corta:** *"Es deliberado y está declarado en el README. La tablet es un dispositivo
compartido de bodega, no una app pública, y lo único que la auditoría exige es poder atribuir
cada captura a una persona. En una implementación real iría contra el directorio de
Colsubsidio."*

### «¿Y el ruido de la bodega?»

**Corta:** *"Es una pregunta que hicimos y que quedó sin responder, así que la tratamos como
riesgo: el micrófono es de presionar para hablar, no de escucha continua, y **la voz nunca es
el único camino**. Teclado, búsqueda y escaneo funcionan igual, y sin red."*

---

## Bloque 6 — Las preguntas incómodas

### «¿Ese archivo de exportación sí lo carga Oracle?»

**Corta:** *"No lo sabemos, y lo decimos: preguntamos dos veces en las sesiones y la respuesta
quedó entrecortada las dos veces. Lo que hicimos es la apuesta más segura: la hoja espeja
**exactamente** las columnas del archivo que ustedes nos dieron, con el nombre del artículo
literal. Y sacamos también un CSV plano por si acaso."*

> No intentar tapar esto. Está en el README como limitación declarada. Un jurado que ya sabe
> que la pregunta quedó sin responder va a valorar que lo digan antes que él.

### «¿Por qué no códigos de barras, que sería más simple?»

**Corta:** *"Porque ustedes nos dijeron que no todos los productos tienen ID único en la
aplicación. Por eso el nombre es la llave. Lo que sí hicimos es darle la vuelta: si el
producto no se puede identificar, se identifica **el estante**. La app genera etiquetas QR
imprimibles en el orden físico del almacén."*

### «Esto ya existe en el mercado, ¿no?»

**Corta:** *"Existen apps de inventario. Lo que no encontramos es una que respete el conteo
ciego **y** funcione sin red **y** empareje por nombre sucio. Esas tres juntas son suyas, no
del mercado: salen de cómo ustedes cuentan hoy."*

### «¿Cuánto de esto lo escribió una IA?»

**Corta:** *"Bastante, y lo usamos como herramienta, no como excusa. Lo que importa es que
cada decisión de diseño sale de algo que ustedes dijeron en las sesiones, y que está
verificado: 69 pruebas automatizadas más 9 end-to-end, incluida una que falla si el conteo deja de ser ciego."*

---

## Números que pueden citar (todos verificados)

| Dato | Valor |
|---|---|
| Artículos distintos / filas de stock | **936 / 1.405** |
| Bodegas listadas (con hoja de stock) | **48** (8) |
| Acierto del emparejador | **94,3% exacto · 99,4% en top-5** |
| Tiempo por consulta | **0,101 ms** |
| Precisión del auto-aceptado | **99,8%** sobre 3.517 casos |
| Pruebas automatizadas | **69** (61 del núcleo + 8 del conteo ciego) + **9 end-to-end** con Playwright |
| Suciedad heredada que se maneja | 79 saldos negativos · 16 decimales en artículos por unidad · 252 filas sin número |
| Nombres truncados por el sistema origen | **51** a exactamente 40 caracteres |
| Digitación que se elimina | **~2 días por ciclo** (dato de ustedes) |

---

## Si algo falla en vivo

- **Si el demo grabado no carga:** *"lo tengo en video, pero mejor: la URL está abierta,
  ábranla ustedes"* — está desplegada y con datos.
- **Si preguntan algo que no sabemos:** decirlo. *"No lo medimos"* / *"esa pregunta quedó sin
  respuesta en las sesiones y la tratamos como supuesto declarado"*. En este proyecto,
  **nueve de las diez preguntas que más queríamos resolver nunca se respondieron**; lo que
  salvó el build fue convertir cada una en una decisión declarada en vez de un supuesto
  silencioso. Esa frase, dicha con calma, vale más que inventar un número.
