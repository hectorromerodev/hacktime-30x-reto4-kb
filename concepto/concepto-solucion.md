# Concepto de solución — Reto 4 · Hotelería

**Estado: DRAFT v0.1 (2026-07-25)** — primera bajada del concepto con lo que ya está en el KB.
Escrito para iterarse: la sección §8 (UI/UX) es explícitamente el borrador que vamos a romper y rehacer.

> ⚠️ **Este documento quedó atrás de la implementación.** Se escribió en paralelo a la construcción
> de la app y **la app ya existe** en [`app/`](../app/), desplegada en
> <https://conteo-inventarios.vercel.app>. Donde el concepto y el código no coincidan, **manda el
> código**. Se conserva por lo que sí sigue vigente: el razonamiento de diseño, las restricciones
> que salieron de los lives y las decisiones que hubo que tomar. Ver §11 para las diferencias ya
> identificadas.

Fuentes de todo lo que se afirma aquí: `reto/reto-04-hoteleria.md` (brief oficial),
`lives/2026-07-22-explicacion-reto4-sVcLdIF0bjo.md` (Q&A con Colsubsidio),
`lives/2026-07-22-apertura-DNi722_GAgw.md` (reglas y criterios),
`lives/2026-07-24-charla-gana-el-mejor-pitch-QICdEq8shoQ.md`,
`lives/2026-07-25-charla-human-in-the-loop-0GsbetGl-JU.md`,
`datos/BODEGAS-Y-STOCK-perfil.md` (dataset real) y `research/blind-spots.md`.

**Reloj:** entrega domingo 2026-07-26, 11:30am hora Colombia (repo congelado, link usable + video de 2 min).
Los streams "Pitches Finales" y "Premiación" ya están agendados en el canal (`4k3I5OXcnjk`, `V4VOUDjyHHY`);
por el contador de YouTube caen ≈1:00pm y ≈4:00pm hora Colombia del domingo — **estimación derivada**, no agenda oficial.

---

## 0. La apuesta, en una frase

> El error no nace al contar: nace cuando lo contado pasa por papel y se vuelve a teclear.
> Matamos el papel y el reteclado, dejando intacto el control ciego de auditoría que Colsubsidio ya tiene.

## 1. Nombre y promesa

**Cuenta Clara** — *lo que se cuenta entra limpio a la primera.*

Promesa medible para el líder de costos de Piscilago: los ~**2 días de digitación** por ciclo mensual
(dato de la propia dueña del proceso en el live) pasan a **cero**, y el descuadre se detecta durante el
conteo, no una semana después.

## 2. Qué construimos — el sistema en cinco piezas

### 2.1 Captura en tablet, offline-first
PWA instalable en la tablet corporativa (las políticas de Colsubsidio prohíben celular personal/WhatsApp
en bodega; **tablet es el dispositivo sancionado**). Funciona sin red: no todas las bodegas tienen red
corporativa, así que la app descarga el catálogo de *su* bodega antes de entrar y guarda todo en local.

Entrada principal: **voz push-to-talk**. El contador aprieta, dice *"arroz doña pepa, doce kilos"*, suelta.
Entrada secundaria siempre disponible: teclado numérico sobre la lista pre-cargada (si hay ruido, si el
artículo no se reconoce, si el contador prefiere teclear). La voz es un acelerador, nunca una cárcel.

> Por qué voz: no es idea nuestra. El propio moderador de Colsubsidio propuso un agente de voz sin que
> nadie se lo pidiera, y usó exactamente el ejemplo del 30 que se lee 50. Construir hacia ese modelo
> mental es la apuesta de menor riesgo.

### 2.2 Resolución de artículo + cantidad + unidad
El problema técnico real no es transcribir: es **casar lo dicho contra el catálogo**. Los códigos de barras
no sirven de eje (no todos los productos tienen ID único en la app), así que el emparejamiento difuso carga
el peso.

Lo que lo hace tratable: **el espacio de búsqueda es por bodega, no global**. El dataset real tiene 936
artículos distintos en total, pero cada bodega maneja entre **56 y 344 filas**. Emparejar contra 200
nombres conocidos es un problema resuelto; contra 936 abiertos, no.

Capas de emparejamiento, en orden:
1. **Normalización** del catálogo (espacios dobles, no-break `\xa0`, prefijos tipo `AFVT)`) — el perfil
   documenta hasta 25 filas con problemas de higiene en una sola hoja.
2. **Coincidencia exacta** sobre el nombre normalizado.
3. **Difusa por trigramas + fonética española** (arroz/aroz, ajonjolí/ajonjoli).
4. **Restricción por unidad esperada**: el catálogo ya dice si ese artículo es `Unidad`, `Kilogram`,
   `Liter` o `Portion`. Si el contador dice "gramos" sobre un artículo en `Kilogram`, eso no se adivina:
   se pregunta. Ahí muere el "cinco kilos ≠ cinco gramos" del brief.
5. **Desambiguación explícita** cuando hay empate (arroz vs. arroz doña pepa): la app muestra los 2–3
   candidatos y el contador toca uno. Nunca elige sola.

### 2.3 Guardián de anomalías en dos niveles — **la decisión de diseño que nos defiende**
El brief pide "detectar anomalías antes de guardar". El live pide "el conteo es ciego, el contador nunca
ve lo que el sistema espera". Esas dos cosas chocan de frente, y creemos que ahí se cae la mayoría de las
soluciones que va a ver el jurado. Nuestra respuesta:

**Nivel 1 — durante el conteo (ciego total).** Solo se cuestionan errores de *captura*, jamás de *cantidad
esperada*. Nada de lo que se pregunta aquí depende del saldo del sistema:
- confianza baja del reconocimiento → *"¿dijiste 90 o 9?"* (la pregunta nace del audio, no del ERP);
- unidad incongruente con el catálogo;
- decimal imposible (3.5 en un artículo que se cuenta por `Unidad`);
- artículo no reconocido o ambiguo;
- repetido en la misma sesión.

**Nivel 2 — al cerrar la bodega, con el auditor (antes de enviar).** Aquí sí se contrasta contra el sistema
y el patrón histórico, y sale una lista corta: *"3 artículos para recontar"*. El reconteo por novedad
**ya existe hoy** en el proceso de Colsubsidio; lo único que cambia es que ocurre en la bodega, en minutos,
en vez de descubrirse días después en la digitación.

> Esto no es una concesión: es la mejora. Hoy la novedad viaja hasta el líder de costos y regresa.
> Nosotros la resolvemos con el producto todavía en la mano.

La regla de oro, tomada de la charla de human-in-the-loop: **la app nunca decide**. Marca, explica en
español llano y el humano resuelve. Si el contador ratifica su número contra la bandera, se guarda su
número y el override queda en el log de auditoría con su nombre, la hora y el audio.

### 2.4 Salida limpia, lista para el ERP
No integramos con el ERP (está fuera de alcance por escrito). Producimos el archivo que hoy se teclea a
mano, **con las mismas columnas del insumo** que nos dieron —las notas oficiales dicen textualmente que el
xlsx *"es el mismo formato que el personal del hotel digita manualmente en su hoja de inventario"*—:
`Nr.Artículo`, `Artículo`, `Unidad`, cantidad contada, más metadatos de auditoría (bodega, fecha de corte,
quién contó, quién auditó).

### 2.5 Panel del líder de costos
Web, post-sincronización. Tres vistas y ni una más:
- **Avance**: qué bodegas están contadas, cuáles en curso, cuáles sin empezar (hoy no existe ningún
  marcador digital de "ya conté esto" — se guía por orden físico y grupos de familia).
- **Contado vs. sistema**: la diferencia por artículo, ordenada por impacto. La dueña del proceso puso esto
  en su lista de deseos aunque el brief lo marque como bonus → lo tratamos como obligatorio.
- **Descuadres que se repiten**: mismo artículo, misma bodega, mes tras mes. Es el reporte que convierte
  la herramienta de captura en una herramienta de gestión.


---

## 3. El flujo, paso a paso (y a la vez, el guion de la demo)

1. **Antes de entrar.** El contador abre Cuenta Clara en la tablet, elige bodega
   (*Restaurante Fuentes AyB*, 344 artículos) y toca **Descargar para offline**. Barra de progreso, listo.
   A partir de aquí puede irse el wifi y no pasa nada.
2. **Cuenta por grupo de familia**, en el mismo orden físico en que ya recorre la bodega. La app nunca
   muestra cantidad esperada: solo el nombre del artículo y su unidad.
3. **Habla.** *"Arroz doña pepa, doce kilos."* La app escribe la tarjeta: `ARROZ DOÑA PEPA · 12 Kilogram`,
   la lee de vuelta en una línea y pasa a la siguiente. Sin tocar la pantalla.
4. **Duda de captura.** *"Harina, noventa."* La app tenía baja confianza en el número →
   *"¿Noventa o nueve?"* con dos botones grandes. Un toque, sigue.
5. **Unidad incongruente.** *"Cinco gramos de harina."* El catálogo dice que la harina va en kilos →
   *"El catálogo maneja harina en kilos. ¿Cinco kilos, o cinco gramos convertidos?"*
6. **Cierra la bodega.** Resumen: 344 artículos, 341 capturados, 3 sin contar. Botón **Revisar y cerrar**.
7. **Nivel 2, con el auditor.** *"3 artículos para recontar"* — con el motivo en lenguaje llano, no un score.
   El auditor recorre, reconfirma o corrige, firma.
8. **Sincroniza.** Al volver a cobertura: sube. En el panel aparece la bodega en verde, con su
   contado-vs-sistema y su archivo listo para el ERP.

**Momento de la demo que hay que clavar:** el paso 4. Ese es el 9↔90 del brief, muriendo en vivo, en
segundos, delante del jurado.

## 4. Reglas de anomalía — fundadas en el dataset real, no inventadas

Todo lo de abajo sale del perfil de `BODEGAS Y STOCK.xlsx`, no de la imaginación. Eso es lo que las hace
defendibles en el Q&A:

| Regla | Evidencia en el dataset real |
|---|---|
| Saldo negativo imposible | **79 filas con SD negativo** repartidas en 6 de las 8 hojas (46 solo en Restaurante Fuentes AyB) |
| Decimal en artículo contado por unidad | **16 filas** con SD decimal *y* unidad `Unidad` — los "decimales raros" que mencionó la dueña del proceso |
| Salto de magnitud (el 9↔90) | Rango brutal dentro de una misma hoja: máximos de 41.500 y 28.000 conviviendo con conteos de un dígito |
| Artículo sin identificar | **252 filas sin `Nr.Artículo`** (suma de la columna del perfil) → el nombre es la llave real, el emparejamiento difuso es obligatorio |
| Nombre sucio / homologación | Espacios dobles, `\xa0`, prefijos `AFVT)`; 341 artículos aparecen en ≥2 bodegas con el mismo nombre |
| Unidad incongruente | 4 unidades en juego: `Unidad`, `Kilogram`, `Liter`, `Portion` — todas pre-declaradas por artículo |

> ✅ Reconciliado: son **252** filas sin `Nr.Artículo` (el mensaje de commit del perfil decía 241).
> Ese es el número que va al pitch.

**Sin histórico no hay detección de patrón.** El insumo es un corte único, sin serie temporal. Para el
Nivel 2 y para el reporte de descuadres repetidos **sintetizamos 6 meses de histórico** a partir del corte
real (con estacionalidad y merma plausibles) y lo decimos en voz alta en el pitch y en el README. Ocultarlo
sería exactamente el tipo de cosa que un jurado que conoce el proceso detecta en el Q&A.

## 5. Stack propuesto (borrador — sujeto a lo que el equipo prefiera)

Criterio: que exista un **link vivo que el jurado pueda usar** ("hasta que no lo usemos… no es tan real") y
que el offline sea de verdad, no una diapositiva.

| Capa | Propuesta | Por qué |
|---|---|---|
| App | PWA (Vite + React) instalable, service worker | Tablet-first sin pasar por tiendas; el jurado la abre desde el navegador |
| Datos locales | IndexedDB (catálogo de la bodega + sesión de conteo) | Offline real, sincronización diferida |
| Voz online | Deepgram o Gemini (créditos del hackathon: $15.000 y $300) | Precisión alta cuando hay red |
| Voz offline | Reconocimiento local con **vocabulario cerrado** (los 56–344 artículos de la bodega + números) | El único camino honesto sin red; el audio queda guardado y se re-transcribe al sincronizar |
| Confirmación hablada | TTS corto (ElevenLabs tiene 10.000 créditos/mes gratis) o voz del sistema | Cerrar el lazo sin mirar la pantalla |
| Emparejamiento | Trigramas + fonética ES, en cliente | Debe funcionar sin red; con 344 candidatos sobra |
| Backend / panel | API mínima + Postgres, desplegado (DigitalOcean tiene $200 en créditos) | Sincronización, panel y export |

**Nota de honestidad técnica:** la charla de Gemini Live API dejó claro que es **online-only**. Si la voz
depende de la nube, el requisito de offline se cae. Por eso el diseño es *grabar siempre en local, resolver
donde se pueda*: con red, en la nube; sin red, con el reconocedor local acotado; y en el peor caso, teclado
sobre la lista. La sesión nunca se bloquea por falta de señal.

## 6. Recorte para el domingo 11:30 (lo que sí entra al MVP)

Ordenado por lo que el jurado tiene que poder *usar*:

**Imprescindible (sin esto no hay entrega)**
1. Selección de bodega + descarga del catálogo real del xlsx.
2. Captura por voz con confirmación, sobre una bodega real (sugerido: *Kiosco Taquilla AyB*, 58 filas —
   pequeña, demostrable, con 6 saldos negativos ya en el dataset).
3. Emparejamiento difuso + desambiguación de 2–3 candidatos.
4. Guardián Nivel 1 (confianza, unidad, decimal imposible).
5. Cierre de bodega → export con las columnas del insumo.
6. Modo avión funcionando de verdad en la demo (apagar el wifi en cámara es el mejor truco del video).

**Muy deseable**
7. Guardián Nivel 2 + reporte contado-vs-sistema.
8. Panel de avance por bodega.

**Si sobra tiempo (no antes)**
9. Descuadres repetidos mes a mes · 10. Log de auditoría con audio · 11. Multi-bodega en paralelo.


---

## 7. UI/UX — primer borrador (**esta es la sección que vamos a iterar**)

Contexto físico que manda sobre cualquier gusto estético: tablet sostenida con una mano, la otra mano
moviendo producto, bodega fría o con ruido, posible guante, luz mala, y una persona que hoy hace esto con
lápiz y papel y no quiere aprender software.

**Principios de partida**
1. **La pantalla es confirmación, no formulario.** Si el contador tiene que mirar fijo para avanzar, perdimos.
2. **Un pulgar, un toque.** Todo lo accionable en la franja inferior, botones de ≥64px.
3. **Ciego por diseño.** Ninguna pantalla del modo conteo muestra jamás la cantidad esperada. Ni de reojo.
4. **La duda se ve distinta al error.** Ámbar = "confirma esto"; nunca rojo, nunca "incorrecto". El contador
   no se equivocó: el sistema no está seguro.
5. **Cero pantallas de carga sin salida.** Sin red, la app sigue: lo dice una vez, discreta, y no vuelve a molestar.

**Pantallas del v0 (a rediseñar)**

| # | Pantalla | Contenido mínimo | Lo que hay que resolver mejor |
|---|---|---|---|
| 1 | Elegir bodega | Buscador + estado offline de cada una | 48 bodegas con nombres casi idénticos ("kiosco 2 suministros" vs "kiosco 2 piscilago") |
| 2 | Preparar bodega | Descarga del catálogo, progreso, "listo para entrar sin señal" | Que se sienta un ritual de 5 segundos, no una configuración |
| 3 | **Conteo (la pantalla que importa)** | Grupo de familia actual · artículo en curso · botón grande de voz · últimas 3 tarjetas capturadas | Cómo se ve "escuchando", cómo se corrige la tarjeta anterior sin salir del flujo |
| 4 | Confirmación en línea | Pregunta de una frase + 2 botones enormes | Que no rompa el ritmo: debe resolverse en menos de 2 segundos |
| 5 | Desambiguación | 2–3 candidatos, nombre completo, unidad | Empates tipo arroz / arroz doña pepa sin obligar a leer párrafos |
| 6 | Cierre de bodega | Contados / faltantes / a recontar | Que el "faltan 3" no se lea como regaño |
| 7 | Reconteo con auditor | Lista corta con motivo en español llano | Es la única pantalla que puede mostrar contraste; marcar visualmente que se salió del modo ciego |
| 8 | Panel (web, líder de costos) | Avance · contado vs sistema · repetidos | Es para otra persona, otro dispositivo y otro momento: no heredar la estética de bodega |

**Microcopy — tono de partida** (todo en español, tuteo, frases de una línea):
- Escuchando: *"Te escucho…"*
- Capturado: *"Arroz doña pepa · 12 kilos ✓"*
- Duda numérica: *"¿Noventa o nueve?"*
- Duda de unidad: *"La harina va en kilos. ¿Cinco kilos?"*
- No reconocido: *"No lo encontré en esta bodega. ¿Cuál de estos?"*
- Offline: *"Sin señal. Sigue contando, yo guardo todo."*
- Nivel 2: *"Tres artículos vale la pena recontarlos antes de cerrar."*

**Lo que ya sabemos que está flojo en este v0** (candidatos a la próxima iteración):
- La corrección de la tarjeta anterior no está diseñada, y va a pasar todo el tiempo.
- No hay diseño para dos personas contando la misma bodega (Colsubsidio tampoco lo tiene resuelto:
  la pregunta se hizo en vivo y la respuesta fue incoherente). Asumimos reparto por grupo de familia
  y lo declaramos como supuesto.
- Conteos parciales ("una caja y tres unidades sueltas") están permitidos y **no tienen UI todavía**.
- Falta el estado "artículo que no está en el catálogo pero está físicamente en la bodega".

## 8. Pitch de 2 minutos (esqueleto, según la charla del 24)

| Tiempo | Qué |
|---|---|
| 0:00–0:20 | **Gancho con el dolor, no con nosotros.** Un dígito mal leído, 48 bodegas, 2 días de digitación cada mes. Nada de "hola, somos el equipo…" |
| 0:20–0:40 | **Qué es, en un resultado**: el contador habla, la app confirma, marca lo dudoso, y lo contado entra limpio al sistema. Sin lista de features |
| 0:40–1:30 | **Demo narrada en vivo** — un solo recorrido: bodega real → voz → el 9↔90 muriendo en pantalla → wifi apagado → cierre y export |
| 1:30–1:40 | **Por qué encaja en Colsubsidio**: tablet, offline, conteo ciego intacto, salida con las columnas de su propio formato |
| 1:40–2:00 | **Equipo y siguiente paso**: piloto en Piscilago el próximo cierre de mes |

Reglas duras de la charla: ensayar con cronómetro, tener el MP4 de respaldo (el wifi de la sede va a
fallar), y en el Q&A responder **cómo** está resuelto (confianza del ASR + emparejamiento difuso +
restricción por unidad), no solo que funciona.

## 9. Lo que NO hacemos (y lo decimos en el pitch)

- No reemplazamos el ERP ni nos integramos con él — está excluido por escrito.
- No tocamos recetas, cocina ni menús (el propio host lo llamó "la siguiente parte").
- No apostamos a códigos de barras como camino principal: no todos los productos tienen ID único.
- No usamos WhatsApp ni celular personal para capturar: política de Colsubsidio.
- No mostramos la cantidad esperada durante el conteo, aunque técnicamente podríamos.
- No entrenamos un modelo propio de anomalías: reglas explicables sobre datos reales, que el auditor
  entiende y puede discutir.
- **No hacemos recepción de mercancía** — y no por desconocerla: Colsubsidio nos describió el
  proceso completo (proveedor → almacén principal → pedido interno de cada bodega; llega en
  **remisión o factura, en papel**, recibida por el almacenista o el auxiliar). Está en
  [`research/proceso-recepcion-mercancia.md`](../research/proceso-recepcion-mercancia.md). Es el
  mismo problema — papel que alguien digita después — y el mismo núcleo lo resolvería, pero el reto
  pide la **toma de inventarios**. Es el primer punto del roadmap, no del alcance.

## 10. Riesgos y cómo los tapamos

| Riesgo | Mitigación |
|---|---|
| El ASR falla con ruido de bodega (nunca se discutió en los lives) | Push-to-talk, vocabulario cerrado, confirmación hablada, teclado siempre a un toque |
| Offline + voz en la nube son incompatibles | Grabar local siempre; resolver en nube si hay red, local si no; nunca bloquear la sesión |
| Sin histórico real, el Nivel 2 se sostiene en datos sintéticos | Declararlo explícitamente en README y pitch; las reglas duras (negativos, decimales, unidad) sí salen del dataset real |
| El jurado abre el link y algo se rompe | Demo con datos precargados, sin login, ruta feliz probada; MP4 de respaldo |
| Nos enamoramos de la voz y llegamos sin export | El export es imprescindible #5 del MVP; la voz sin salida limpia no resuelve el reto |
| Quedan ~21 horas | El recorte de §6 es en orden; nada de la lista "si sobra tiempo" arranca antes de cerrar la imprescindible |

## 11. Dónde el concepto ya quedó atrás del código

Revisado contra `app/` y el README de la raíz el 2026-07-25:

1. **Nombre**: "Cuenta Clara" fue propuesta y **no se adoptó** — el proyecto se llama
   *Conteo de inventarios · Piscilago*.
2. **Repo de la solución**: el concepto decía que no existía. **Sí existe**: la app vive en este mismo
   repositorio, bajo `app/` (core + API Fastify/Prisma + web Next.js), con demo en producción.
3. **Repo público**: decidido — se asume público y se enlaza como investigación del proyecto.
4. **Reglas de anomalía**: el concepto plantea un puñado; la implementación tiene **9**.
5. **Conteo ciego**: el concepto solo lo prohíbe por diseño; la implementación además lo **prueba**
   (`app/apps/api/src/conteoCiego.test.ts` falla si la cantidad esperada se filtra) y expone únicamente
   el *orden de magnitud*, no el saldo.
6. **Emparejamiento difuso**: el concepto lo deja como propuesta; ya está medido contra los 936 nombres
   reales — acc@1 94.3%, acc@5 99.4%, 0.10 ms por consulta.
7. **Unidades**: el concepto solo pregunta ante incongruencia; la implementación **convierte gramos y
   muestra la conversión**, y **bloquea** cuando la unidad no corresponde.
8. **Filas sin `Nr.Artículo`**: reconciliado en **252** (el mensaje de commit del perfil decía 241).

Sigue abierto: columnas exactas del export (nunca se respondió con claridad en el live), bodega para
la demo del video, y quién narra los 2 minutos.

---

**Siguiente iteración de este doc:** §7 (UI/UX) con pantallas dibujadas, estados de la tarjeta de captura,
y el flujo de corrección — que hoy es el hueco más grande del concepto.