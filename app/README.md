# Conteo de inventarios · Piscilago

Captura inteligente en la toma física de inventarios — **Reto 4 · Hotelería**, Hackathon Colsubsidio × 30X.

### ▶ Demo en vivo: **https://conteo-inventarios.vercel.app** · Ana Gómez / `1111`

> Hoy: alguien cuenta en papel → otra persona lo digita en el sistema (**~2 días por ciclo**) → una tercera revisa.
> Ahí nacen los errores: "9 cajas" registrado como 90, un 3 que se lee como 5, gramos confundidos con kilos.
>
> Esta app **solo cuenta y exporta**. No reemplaza el ERP ni se integra con él (explícitamente fuera del alcance del reto).
> La auditoría vive en otra aplicación.

---

## Índice

1. [Cómo correrlo](#1-cómo-correrlo)
2. [Probarlo](#2-probarlo)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Comandos útiles](#4-comandos-útiles)
5. [Cómo está construido](#5-cómo-está-construido)
6. [Decisiones de diseño](#6-decisiones-de-diseño-y-por-qué)
7. [Problemas comunes](#7-problemas-comunes)
8. [Limitaciones declaradas](#8-limitaciones-declaradas)
9. [Tests](#9-tests)

---

## 1. Cómo correrlo

### Requisitos

| | Versión | Para qué |
|---|---|---|
| Docker + Docker Compose | 24+ / v2+ | Ruta recomendada, levanta todo |
| Node.js | **24+** | Solo para la ruta sin Docker (usa *type stripping* nativo) |
| pnpm | 11+ | Solo para la ruta sin Docker (`corepack enable`) |

### Opción A — Docker (recomendada)

```bash
cp .env.example .env
docker compose up --build
```

Eso levanta cuatro servicios: **Postgres 18**, la **API**, la **web** y **Caddy** (que emite HTTPS solo).
La primera vez la API sincroniza el esquema y carga el Excel real; tarda ~1 min.

Abre **https://localhost**

> El certificado es local, así que el navegador va a advertir una vez. Acéptalo:
> **HTTPS no es opcional aquí** — el micrófono y la cámara solo funcionan en contexto seguro.

Entra con cualquiera de estos usuarios de demostración:

| Usuario | PIN | Rol |
|---|---|---|
| Ana Gómez | `1111` | contador |
| Luis Ramírez | `2222` | contador |
| Sandra Peña | `3333` | contador |
| Bibiana Torres | `9999` | líder de costos (ve cierre y exportación) |

### Opción B — Sin Docker (desarrollo)

Necesitas un Postgres corriendo. El más rápido:

```bash
docker compose up -d postgres
```

Luego, en tres terminales:

```bash
pnpm install
```

```bash
cd apps/api
export DATABASE_URL="postgresql://conteo:conteo_local_dev@localhost:5432/conteo?schema=public"
pnpm exec prisma generate
pnpm migrate:deploy    # aplica las migraciones versionadas
pnpm seed              # carga el Excel real
pnpm dev
```

```bash
cd apps/web
NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm dev
```

Abre **http://localhost:3000**

> En `http://localhost` el navegador sí permite micrófono y cámara (localhost cuenta como
> contexto seguro), pero **desde otro dispositivo de la red no**. Para probar en una tablet
> real usa la opción A o un túnel HTTPS.

---

## 2. Probarlo

### 2.1 El ciclo normal de conteo

1. Ingresa como **Ana Gómez / 1111**.
2. Elige **Kiosco Piscigiros AyB** (56 artículos — es la bodega más cómoda para demostrar).
3. Toca un artículo → teclea la cantidad → **Guardar**.

Después de guardar **no se preselecciona nada**. El orden de la lista es el de la hoja
del sistema, que no tiene por qué coincidir con el recorrido real del almacén: el contador
va por lo que tiene enfrente en el estante. La app confirma lo guardado y ofrece el
siguiente sin contar como **atajo de un toque**, sin imponerlo.

Fíjate en que la lista **nunca muestra la cantidad que el sistema espera**. Es a propósito
(ver [conteo ciego](#el-conteo-ciego-y-cómo-se-detecta-9--90-sin-romperlo)).

### 2.2 La detección de anomalías (el caso del brief)

1. Selecciona **ACEITE**.
2. Teclea **900** → **Guardar**.

Aparece:

```
⚠ Verificación de cantidad
900 litros está fuera de la escala habitual de ACEITE en esta bodega.
Cuenta otra vez para confirmar.

     ACEITE
     900 litros

[ Volver a teclear ]      ← acción primaria
[ ¿Eran 90? ]             ← el vecino de un dígito
Si es correcto, indica por qué:  (obliga a elegir un motivo)
```

El stock real de ese artículo es **30.59 litros**, y **ese número no aparece por ningún lado**.

Otras reglas que puedes disparar:

| Qué teclear | Qué pasa |
|---|---|
| `2,5` en un artículo que se cuenta en unidades | Pregunta si es un empaque abierto |
| `0` | Pide confirmar que está agotado |
| Un artículo que otro contador ya contó | Avisa quién lo contó, **sin mostrar su cantidad** |

### 2.3 La prueba que decide el reto: sin red

Con el stack corriendo:

1. Abre la app y entra a una bodega (esto descarga el catálogo a IndexedDB).
2. **DevTools → Network → Offline**  *(o simplemente `docker compose stop api`)*.
3. Cuenta 5 artículos.
   → Se guardan al instante. La cabecera muestra **"5 por enviar"**. Cero errores.
4. Vuelve a poner **Online** *(o `docker compose start api`)*.
5. En menos de 20 s el contador baja a cero.

Verifica que llegaron de verdad:

```bash
docker compose exec postgres psql -U conteo -d conteo -c 'SELECT a.nombre, c.cantidad, c.metodo FROM "Captura" c JOIN "Articulo" a ON a.id=c."articuloId" ORDER BY c."recibidoEn";'
```

**Idempotencia:** reenviar el mismo lote no duplica nada. El `clientId` se genera en el
dispositivo antes de tener red y el servidor inserta por esa llave.

### 2.4 Voz

Toca el botón verde grande (o mantenlo presionado) y di, por ejemplo:

- *"cinco kilos de harina"*
- *"medio kilo de arroz"*
- *"quinientos gramos de mantequilla"* → se guarda como **0,5 kg** (conversión visible)
- *"una caja y tres unidades de gaseosa"*

El botón funciona de dos maneras: **tócalo** (queda escuchando hasta que termines la frase)
o **mantenlo presionado** mientras hablas. Mientras escucha muestra *"Escuchando… habla
ahora"* y la transcripción en vivo.

> **Usa Chrome o Edge.** Es donde el reconocimiento de voz del navegador funciona de forma
> confiable. **En Safari el botón responde pero el reconocimiento falla o no devuelve nada**:
> su implementación de la Web Speech API es parcial. La app lo detecta y avisa; el teclado y
> la búsqueda funcionan igual en todos los navegadores.
>
> **Requiere red.** El navegador no tiene reconocimiento de voz offline: Chrome envía el
> audio a servidores de Google. Sin señal el micrófono se desactiva solo y avisa.
> Ver [limitaciones declaradas](#8-limitaciones-declaradas).

### 2.5 Cámara

Botón **Escanear**. Lee códigos de barras y los **QR de estante** que genera la propia app
(`/etiquetas/<conteoId>`, imprimible). Necesita HTTPS.

### 2.6 Cierre y exportación

Ingresa como **Bibiana Torres / 9999** → botón **Cierre** → verás:

- resumen (contados, sin contar, con diferencia, exactitud),
- tabla de **diferencias contra el sistema**,
- **Excel de 3 hojas** y **CSV**.

| Hoja | Para qué |
|---|---|
| `CONTEO` | Mismas columnas del archivo de insumo (`CANTIDAD, Nr.Artículo, Artículo, Unidad, SD`). Reemplaza el paso de digitación. |
| `DIFERENCIAS` | Contado vs sistema, diferencia, %, estado, contador, anomalías y **el motivo declarado**. |
| `TRAZABILIDAD` | Cada captura: quién, cuándo, método, texto literal dictado y anomalías. Insumo para la app de auditoría. |

El CSV sale con **BOM y separador `;`**, que es lo que Excel en configuración regional
colombiana abre sin romper acentos ni columnas.

### 2.7 Evaluación del matcher fuzzy

```bash
cd packages/core && node --experimental-strip-types src/eval/evalFuzzy.ts
```

Mide el motor de coincidencia contra los **936 nombres reales** del catálogo, con seis
tipos de deformación (dictado parcial, typos, letras faltantes, orden invertido…):

```
GLOBAL  acc@1 = 94.3%   acc@5 = 99.4%
Latencia media por consulta: 0.10 ms
Precisión del auto-aceptado: 99.8% sobre 3517 casos
```

---

## 3. Variables de entorno

Copia `.env.example` a `.env`. Todas tienen valor por defecto para desarrollo.

| Variable | Por defecto | Para qué |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `conteo` / `conteo_local_dev` / `conteo` | Credenciales de Postgres |
| `DATABASE_URL` | — | Cadena de conexión (la arma `docker-compose` sola) |
| `API_PORT` | `4000` | Puerto de la API |
| `JWT_SECRET` | valor de desarrollo | **Cámbialo en producción** |
| `NEXT_PUBLIC_API_URL` | `/api` en Docker, `http://localhost:4000` en dev | A dónde llama el navegador |
| `SITE_ADDRESS` | `localhost` | Dominio para Caddy. Pon el real y emite un certificado de Let's Encrypt |
| `ORIGEN_WEB` | `http://localhost:3000` | Orígenes permitidos por CORS (solo aplica en despliegue partido) |
| `PUERTO_HTTP` / `PUERTO_HTTPS` / `PUERTO_POSTGRES` | `80` / `443` / `5432` | Puertos publicados en el host |
| `GEMINI_API_KEY` | vacío | Opcional. La app funciona completa sin esto |

> **Nunca commitees el `.env`.** El repo es público por reglas del hackathon y `.gitignore`
> ya lo excluye.

---

## 4. Comandos útiles

```bash
docker compose up --build          # levantar todo
docker compose logs -f api         # ver logs de la API
docker compose down                # apagar
docker compose down -v             # apagar y BORRAR la base
docker compose stop api            # simular caída de red para probar offline
```

```bash
pnpm --filter api seed -- --reset  # recargar el catálogo desde el Excel
```

El seed es **idempotente**: correrlo dos veces no duplica nada, así que reiniciar el
contenedor es seguro. Con `--reset` sí vacía y recarga.

### Migraciones de base de datos

El esquema se versiona con migraciones de Prisma, en
[`apps/api/prisma/migrations/`](apps/api/prisma/migrations/). No se usa `prisma db push`:
`migrate deploy` aplica solo las migraciones que están en el historial, sin inferir cambios.

```bash
cd apps/api
pnpm migrate:estado    # ¿qué migraciones faltan por aplicar?
pnpm migrate:deploy    # aplicar pendientes (esto corre solo al arrancar el contenedor)
pnpm migrate:dev --name lo_que_cambiaste   # crear una nueva tras editar schema.prisma
```

El contenedor de la API corre `prisma migrate deploy` en cada arranque, así que desplegar
una versión nueva aplica sus migraciones automáticamente.

> Si tu base local se creó antes con `db push`, no tiene historial y `migrate deploy` va a
> rechazarla. Lo más rápido es recrearla: `docker compose down -v && docker compose up`.

---

## 5. Cómo está construido

```
app/
├── packages/core/          TypeScript puro, SIN dependencias.
│   ├── normalizar.ts       limpieza de nombres del catálogo
│   ├── numerosEspanol.ts   "treinta y cinco" → 35
│   ├── unidades.ts         léxico de unidades y conversiones
│   ├── parseEspanol.ts     "cinco kilos de harina" → {5, Kilogram, "harina"}
│   ├── fuzzy.ts            índice invertido + puntaje  ← el crux técnico
│   └── anomalias.ts        las reglas R1–R9
├── apps/api/               Node 24 + Fastify + Prisma + Postgres 18
└── apps/web/               Next.js 16 + Tailwind 4 + Dexie (PWA)
```

`packages/core` es la pieza clave: **el mismo matcher y las mismas reglas corren en el
navegador sin red y en el servidor al sincronizar**. Un solo código, cero divergencia.

### Los datos

Se cargan de `../datos/BODEGAS Y STOCK.xlsx`, el archivo real que entregó Colsubsidio:

- **48 bodegas** listadas (una duplicada exacta, se colapsa) — **solo 8 traen hoja de stock**.
  Las otras se listan igual en la app, marcadas, para no aparentar que se ocultó algo.
- **936 artículos** distintos, **1.405 filas** de stock.
- Suciedad heredada que el sistema maneja explícitamente: **79 saldos negativos**,
  **16 decimales sobre artículos que se cuentan por unidades**, **252 filas sin `Nr.Artículo`**,
  espacios no-rompibles dentro de los nombres, un encabezado con typo (`CANTIDA`), y
  **nombres truncados a 40 caracteres** por el sistema origen.

---

## 6. Decisiones de diseño (y por qué)

### El conteo ciego, y cómo se detecta 9 → 90 sin romperlo

Colsubsidio fue explícito en la sesión de explicación:

> *"Se hace de manera ciega para asegurar que la persona que está contando cuente realmente
> lo que hay, no lo que el sistema está esperando."*

Pero el brief también pide detectar que alguien reportó 90 donde normalmente hay 9 — y eso
exige conocer lo esperado. Y tiene que funcionar **sin red**, o sea con el dato ya en la tablet.

**La solución:** el dispositivo nunca recibe `SD`. Recibe **`exp10`**, el orden de magnitud
(`floor(log10(sd))`).

Con eso alcanza para detectar que 900 está dos órdenes por encima de lo habitual. Y **no**
alcanza para copiar la respuesta: quien abriera las herramientas del navegador solo
aprendería *"esto suele estar en las decenas"*. La integridad de la auditoría queda intacta
y la detección funciona en modo avión.

Está garantizado por arquitectura, no por disciplina: `SD` vive en su propia tabla y el
endpoint de catálogo usa un `select` explícito que no lo pide.

### El matcher por nombre, no por código de barras

> *"En el sistema no tenemos… no todos los productos tienen un ID único."*

Por eso el nombre **es** la llave, y acertarle con voz ruidosa sobre un catálogo sucio es
el problema técnico central. El motor usa índice invertido por tokens + puntaje por
bigramas, con dos ajustes que vienen de mirar los datos reales:

- **Cobertura asimétrica.** Los nombres vienen truncados a 40 caracteres, así que se mide
  cuánto de la *consulta* cubre el candidato, nunca al revés. Una métrica simétrica
  castigaría al candidato por lo que el sistema origen le cortó.
- **Penalización por número contradicho.** `PORCION DE CADERA X 100 GRS` y
  `… X 130 GRS` son artículos distintos con costo distinto. Un motor de typos los trata
  como casi iguales.

Umbral de auto-aceptación conservador (0.82 con margen de 0.15). Todo lo demás muestra
cuatro tarjetas grandes resaltando **lo que las diferencia** — entre ocho cuchillos, lo útil
es ver *VERDE* vs *AMARILLO*, no leer el nombre completo cuatro veces.

### La voz re-ordenada por el catálogo

Se piden 5 hipótesis al reconocedor y se elige la que mejor puntúa **contra el catálogo**.
El reconocedor no sabe qué hay en Piscilago; el índice sí. *"cinco kilos de arena"* pierde
contra *"cinco kilos de harina"* porque HARINA existe en la bodega y ARENA no.

### Dónde muere el error de gramos vs kilos

El léxico de unidades convierte y **muestra la conversión**: *"quinientos gramos"* se guarda
como `0,5 kg` y queda registrado que se dictó en gramos. Si la unidad dictada no corresponde
a la del catálogo y no hay conversión posible, **se bloquea el guardado**. Sin IA, por
construcción.

### Conteo simultáneo: nunca se suma en silencio

La pregunta "¿qué pasa si dos operarios cuentan la misma bodega?" quedó sin resolver en la
sesión en vivo. Nuestra postura, declarada: si otro contador ya capturó ese artículo, la
captura se marca **en conflicto** y el líder decide si fue recuento (reemplaza) o una
ubicación distinta (suma). Sumar automáticamente duplicaría inventario.

Y el otro contador **nunca ve la cantidad ajena**: el conteo también es ciego entre
contadores, que es justamente el control de auditoría (uno cuenta, otro recuenta).

### Envases sin factor de conversión

Si alguien dice *"tres cajas"* y el catálogo no sabe cuántas unidades trae una caja,
**no se inventa la equivalencia**: se marca y se pregunta una vez. Colsubsidio nunca
publicó factores de conversión; adivinarlos corrompería el conteo.

---

## 7. Problemas comunes

**El navegador advierte que el certificado no es confiable.**
Es el certificado local que emite Caddy. Acéptalo. Sin HTTPS no hay micrófono ni cámara.

**El micrófono no hace nada.**
Tres causas, en orden de probabilidad: (1) estás en `http://` y no en `https://`;
(2) no hay red — la voz la requiere, usa el teclado; (3) el navegador no es Chrome/Edge.

**La app no carga y dice que no hay catálogo descargado.**
Necesita una primera conexión para bajar el catálogo de esa bodega. Después ya funciona
sin red.

**El puerto 80 o 443 está ocupado.**
```bash
PUERTO_HTTP=8080 PUERTO_HTTPS=8443 docker compose up
```

**Quiero empezar de cero.**
```bash
docker compose down -v && docker compose up --build
```

**El seed no carga nada y dice que ya hay datos.**
Es idempotente por diseño. Para forzar: `pnpm --filter api seed -- --reset`.

---

## 8. Limitaciones declaradas

Se listan de frente porque son decisiones, no descuidos.

1. **La voz requiere red.** El navegador no tiene reconocimiento de voz offline real: Chrome
   y Safari envían el audio a sus servidores, y un modelo local (Vosk, Whisper en WASM) pesa
   40 MB o más. Por eso la arquitectura **no depende de la voz**: teclado y búsqueda funcionan
   al 100% sin señal, y el micrófono se desactiva solo cuando no hay conexión. La ruta de
   evolución es `vosk-model-small-es` cacheado por el service worker — trabajo acotado, no
   una incógnita de investigación.

2. **El formato exacto que carga Oracle no está confirmado.** Se preguntó en vivo y la
   respuesta quedó entrecortada. La hoja `CONTEO` **espeja las columnas del archivo de insumo**,
   que es la apuesta más segura, y además se emite CSV plano como respaldo.

3. **Autenticación mínima a propósito.** Selección de usuario + PIN de 4 dígitos. La tablet
   es un dispositivo compartido de bodega, no una app pública, y lo único que la auditoría
   exige es poder atribuir cada captura a una persona.

4. **Los "grupos de familia" son derivados.** El Excel no trae esa columna; se clasifica por
   palabras clave para repartir el trabajo y agrupar el reporte. No sirve para costear.

5. **Solo 8 de las 48 bodegas tienen datos** en el archivo entregado. Las 48 aparecen en la
   app, marcadas.

6. **No hay serie histórica.** El archivo es un corte único, así que las reglas de anomalía
   se apoyan en el orden de magnitud del corte, no en tendencias. Con varios cierres
   mensuales las mismas reglas mejoran sin cambiar la arquitectura.

### Vulnerabilidades reportadas por `pnpm audit`

`pnpm audit` reporta **6 avisos (4 altos, 2 moderados)**, todos transitivos. Se revisaron
uno por uno; el estado real es este:

> **Se eliminaron dos avisos altos** quitando la dependencia `xlsx` (SheetJS): tenía
> *prototype pollution* y *ReDoS* sin versión parcheada en npm. El seed ahora lee el Excel
> con **`exceljs`**, que el proyecto ya usaba para exportar. Se verificó que el resultado es
> idéntico: mismos 936 artículos, 1.405 filas, 79 negativos, 16 decimales, 252 sin
> `Nr.Artículo`, y los nombres byte a byte iguales (51 truncados a 40 caracteres, 14 con
> espacio no-rompible, 43 con sufijo `(PA)`).

| Paquete | Avisos | Cadena real | Alcance |
|---|---|---|---|
| `postcss` | 2 altos + 1 moderado | `apps/web > next > postcss` (8.4.31) | Solo en tiempo de compilación, sobre CSS propio. No llega al bundle |
| `sharp` | 1 alto (libvips) | `apps/web > next > sharp` | Optimización de imágenes de Next. La app no sirve imágenes de usuario |
| `brace-expansion` | 1 alto (DoS) | `apps/api > exceljs > archiver > …` | Empaquetado del `.xlsx` que se exporta. Las rutas las arma el servidor, no el usuario |
| `uuid` | 1 moderado | `apps/api > exceljs > uuid` (8.3.2) | Interno de `exceljs`. Los UUID de la aplicación los genera `crypto.randomUUID()`, no este paquete |

**Los 6 restantes no se corrigen con una actualización hoy** — verificado, no supuesto:

- **Actualizar Next no los quita.** Se subió de Next 15 a **16.2.11** y los avisos de
  `postcss` y `sharp` siguen exactamente igual: son las versiones que Next fija internamente.
  Forzarlas con `overrides` cambiaría dependencias del framework sin ganancia real, porque
  ninguna es alcanzable en tiempo de ejecución.
- **`brace-expansion` y `uuid` son internas de `exceljs`**, que ya está en su última
  versión (4.4.0).

No queda ninguna dependencia **directa** con avisos abiertos.

**Cómo se eliminarían las de `xlsx`** (no se hizo por tiempo, y queda anotado): el proyecto
ya usa **`exceljs`** para generar los reportes. Usarlo también para *leer* el Excel en
`apps/api/src/seed.ts` quitaría la dependencia `xlsx` por completo — dos avisos altos menos
y una dependencia menos. Es un cambio acotado, de un solo archivo.

---

## 9. Tests

### 9.1 Unitarios

```bash
pnpm --filter @conteo/core test
```

**61 tests** con el test runner nativo de Node.js (`node:test`), sin Jest ni Vitest.
Cubren todo el paquete `core` — el mismo código que corre en el navegador sin red y en
el servidor al sincronizar.

| Módulo | Tests | Qué cubre |
|---|---|---|
| `parseEspanol.test.ts` | 24 | Números en español, fracciones, coma decimal colombiana, conversión g↔kg, conteos compuestos, envases, robustez ante dictado real |
| `anomalias.test.ts` | 23 | Reglas R1–R9, `exp10` (orden de magnitud sin revelar SD), detección 9→90, conteo simultáneo, envases sin factor |
| `normalizar.test.ts` | 14 | `quitarAcentos`: tildes, eñe→n; `normalizar`: espacios no-rompibles (U+00A0), puntuación; `descomponerNombre`: prefijos AFVT), sufijos (PA); `tokenizar` |

### 9.2 E2E (Playwright)

Requiere el stack corriendo (`docker compose up -d`). Se ejecutan en un contenedor
Docker con Playwright + Chromium, conectado a la misma red que los servicios.

```bash
cd app
docker run --rm \
  --network conteo-inventarios_default \
  -e PLAYWRIGHT_BASE=http://web:3000 \
  -v "$PWD:/app" \
  -w /app/apps/web \
  mcr.microsoft.com/playwright:v1.61.1-jammy \
  npx playwright test
```

| Archivo | Tests | Qué cubre |
|---|---|---|
| `tests/ingreso.spec.ts` | 4 | Carga de pantalla, flujo usuario→PIN→bodegas, PIN incorrecto, botón Atrás |
| `tests/conteo.spec.ts` | 5 | Entrar a bodega, seleccionar+contar+guardar, anomalía fuera de escala, búsqueda, offline |

> **Nota:** La imagen `mcr.microsoft.com/playwright` se descarga una sola vez (~750 MB).

---

## Contexto e investigación

La investigación que sustenta estas decisiones (brief oficial, análisis de las sesiones en
vivo con Colsubsidio, perfil del dataset, supuestos y preguntas abiertas) está en la raíz
de este repositorio: [`../reto/`](../reto/), [`../lives/`](../lives/),
[`../research/`](../research/) y [`../datos/`](../datos/).
