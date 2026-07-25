# Guion del pitch de 2 minutos + el número de ROI

Complementa el esqueleto de `concepto-solucion.md` §8 (charla del 24) y el Q&A de
`preguntas-jurado.md`. Aquí está la versión **palabra por palabra y cronometrada** para grabar, más
**el número** con el que se abre. Reglas duras de la charla: ensayar con cronómetro, tener el **MP4
de respaldo** (el wifi de la sede va a fallar), narración corta y con energía.

---

## 1. El número (conservador, con supuestos explícitos)

No se abre con pesos: se abre con **tiempo y riesgo**, y el peso es el piso, no el techo.

**Supuestos (todos declarables en el Q&A):**
- **A.** 1 líder de costos dedica **~2 días/mes** a redigitar y revisar el conteo. *Fuente:* Q&A con
  Colsubsidio (recogido en `concepto-solucion.md` línea 35).
- **B.** Costo-día cargado de ese rol ≈ **COP 150.000** (salario mensual conservador ~COP 2,6–3,3 M ÷
  ~22 días hábiles, con prestaciones). Deliberadamente por el lado bajo para **no inflar** el ahorro.
- **C.** Piscilago es **una** sede. Colsubsidio opera varios hoteles y parques → el mismo ahorro se
  multiplica por sede, **sin comprar un solo equipo nuevo** (corre en las tablets que ya existen).

**El piso (solo mano de obra de digitación, solo Piscilago):**

> 2 días × 12 meses × COP 150.000 ≈ **COP 3,6 M/año liberados** — en **una** sede, en **un solo paso**
> del proceso, **antes** de contar el ahorro por errores y el tiempo de conteo/revisión.

**El techo (lo que de verdad importa, y por qué NO le ponemos una cifra inventada):**
- El dataset real tiene **máximos de 41.500 y 28.000 conviviendo con conteos de un dígito** en la misma
  hoja. Un solo `9` leído como `90` en un artículo de valor **desajusta la valoración de esa bodega** y
  dispara una recompra equivocada → **quiebre de stock** (venta de A&B perdida) o **sobrestock**
  (merma en comida, congelados y medicinas). **Un** error de esos al mes ya supera todo el ahorro de
  mano de obra.
- No le ponemos un número de pesos a la merma **a propósito**: no tenemos sus finanzas y sería
  indefendible en el Q&A. Esa honestidad es parte de la estrategia (charla de human-in-the-loop:
  *"declara tus límites, eso es ganador"*).

**Cómo se dice en una línea:** *"Dos días de redigitación se vuelven unas horas. Y un solo dígito mal
leído puede costar más que el sueldo de quien lo digita. Solo mano de obra, solo en Piscilago, son del
orden de 3 a 4 millones al año. Multiplíquenlo por cada hotel y cada parque, sin comprar un solo equipo."*

---

## 2. Guion palabra por palabra (2:00, estructura 20/20/50/10/20)

> Números de bolsillo (todos verificados): **48 bodegas · 936 artículos distintos · 1.405 renglones ·
> 252 renglones sin `Nr.Artículo` · ~2 días de digitación/mes · máximos 41.500 y 28.000 junto a
> conteos de un dígito.**

### 0:00–0:20 · Gancho (el dolor, con dato — no "hola, somos…")
> «Cada fin de mes, en Piscilago, alguien teclea a mano **mil cuatrocientos cinco** renglones de
> inventario. Un **nueve** leído como **noventa** —y pasa— descuadra la bodega entera. Cuarenta y ocho
> bodegas, **dos días** de redigitación al mes. Y el error nace siempre en el mismo punto: cuando
> alguien captura lo que contó.»

### 0:20–0:40 · Qué es (un resultado, sin lista de features)
> «Por eso construimos **Conteo · Piscilago**: una tablet que captura el conteo **en el piso**. El
> contador habla o teclea, la app **marca lo que no cuadra antes de guardar**, y entrega todo limpio,
> listo para el sistema. Sin papel, sin redigitar, sin romper el **conteo ciego** que su auditoría
> exige.»

### 0:40–1:30 · Demo narrada, un solo recorrido (con el wifi apagándose en cámara)
> «Miren. Ana entra a una bodega real. Dice: *"aceite, novecientos"*. La app escribe la tarjeta y
> detecta que **novecientos se sale de la escala** de ese producto. **No** le muestra cuánto espera el
> sistema: el conteo sigue ciego. Solo pregunta: *"¿seguro? ¿no eran noventa?"*. Ana recuenta, dice
> **noventa**, y entra. **Un error de miles de pesos, muerto en dos segundos.**
>
> *(apaga el wifi en cámara)* Y ahora, **sin red**. Apago el wifi y sigo contando con el teclado: en la
> bodega no hay señal. Nada se pierde. Al cerrar, el **líder de costos** ve en su panel lo **contado
> contra el sistema** y descarga el archivo con las **columnas de su propio formato**.»

### 1:30–1:40 · Por qué encaja en Colsubsidio (el "por qué esta tecnología")
> «¿Por qué así? Un agente de voz **en la nube no corre** en esas bodegas: no hay red, y la política
> **prohíbe sacar el inventario** a un tercero. Nuestro emparejamiento difuso y las reglas de anomalía
> corren **en la tablet, sin conexión**. No es una IA más pequeña: es la que **sí se puede desplegar
> aquí**.»

### 1:40–2:00 · Equipo y siguiente paso (cierre en futuro)
> «Somos **Hector Romero, Ayrton Santos, Gerardo Martinez y Rodrigo Sauceda**. Esto **no es una
> maqueta**: lo construimos, lo desplegamos y lo probamos en cinco días. Siguiente paso: un **piloto en
> Piscilago el próximo cierre de mes**, con las tablets que **ya tienen** y el catálogo que **ya
> existe**. Si funciona en Piscilago, funciona en **cada hotel y cada parque** de Colsubsidio.»

**Conteo aprox.:** ~325 palabras ≈ 2:00 a ritmo de pitch. Cronometrar y recortar la demo si se pasa.

---

## 3. Notas de grabación y de Q&A
- **Secuencia técnica crítica:** la **voz depende del reconocedor en la nube** → hacer el tramo de voz
  **con wifi**, y **solo después** apagarlo para el tramo offline (que se cuenta con teclado). Si se
  apaga el wifi antes de hablar, la voz no responde en cámara.
- **Precargar** la demo con `pnpm --filter api demo` (bodega parcial: no arrancar en 0/56).
- **Ruta feliz probada + MP4 de respaldo** por si el link se rompe en vivo (concepto §7).
- **Q&A — dos defensas clave** (detalle en `preguntas-jurado.md`):
  1. *"¿anomalía sin histórico?"* → *"El insumo es un corte único, sin serie temporal. Un histórico
     inventado sería teatro. Detectamos el 9→90 **offline** por orden de magnitud, y se afina cuando el
     piloto acumule histórico real."*
  2. *"¿por qué no un agente de voz cloud?"* → la línea de 1:30–1:40 (no hay red + política + on-device).
