# Conteo de inventarios · Piscilago

**Reto 04 · Hotelería — "Captura inteligente en la toma de inventarios"**
Hackathon Colsubsidio × 30X · 22–26 de julio de 2026

### ▶ Demo funcional: **https://conteo-inventarios.vercel.app**

Entra como **Ana Gómez**, PIN `1111`. (El líder de costos es **Bibiana Torres**, PIN `9999`:
solo ese rol ve el cierre y la exportación.)

---

## El problema

Cada fin de mes, en las bodegas de Piscilago, alguien cuenta producto por producto **en
papel**. Ese papel viaja a otra persona que lo digita en el sistema — **unos dos días de
digitación por ciclo** — y una tercera lo revisa.

Ahí nacen los errores que Colsubsidio describió: *"alguien cuenta 9 cajas y termina
registrado como 90"*, un 3 escrito que se lee como 5, gramos confundidos con kilos.

**Esta solución solo cuenta y exporta.** No reemplaza el ERP ni se integra con él
(explícitamente fuera del alcance del reto); la auditoría vive en otra aplicación.

## Lo que resuelve

| Lo que pide el reto | Cómo se resuelve |
|---|---|
| Capturar más rápido y con menos error que papel + digitar | Dos toques por artículo en tablet: elegir → teclear → **Guardar y seguir**, que avanza solo. También por voz y por escaneo |
| Reconocer producto, cantidad y unidad sin ambigüedad | *"cinco kilos de harina"* → parser de español propio. **Los gramos se convierten y la conversión se muestra**; una unidad que no corresponde **bloquea** el guardado |
| Detectar anomalías **antes** de guardar | 9 reglas. La central: capturar 900 donde el patrón dice decenas pregunta *"¿Eran 90?"* — **sin revelar nunca la cantidad del sistema** |
| Validar contra el catálogo en tiempo real | Motor de coincidencia por nombre sobre los 936 artículos reales: **99.4% de acierto en top-5**, 0.10 ms por consulta, **funcionando sin red** |
| *(Suma puntos)* Reporte de contado vs sistema | Excel de 3 hojas: la que reemplaza la digitación, la de diferencias y la de trazabilidad |

## Las tres restricciones que definieron el diseño

Salieron de las sesiones en vivo con Colsubsidio, no de suposiciones:

**1. El conteo es ciego.** *"Se hace de manera ciega para asegurar que la persona cuente
realmente lo que hay, no lo que el sistema está esperando."*
→ El dispositivo **nunca recibe la cantidad esperada**. Recibe su *orden de magnitud*, que
alcanza para detectar el salto 9→90 en modo avión y no alcanza para copiar la respuesta.
Hay [una prueba automatizada](app/apps/api/src/conteoCiego.test.ts) que falla si ese dato
se filtra.

**2. No siempre hay red.** *"No todos los puntos de venta tienen red corporativa."*
→ La captura se escribe primero en el dispositivo y se sincroniza después, con una llave de
idempotencia generada allí mismo: reenviar un lote nunca duplica.

**3. Los códigos de barras no alcanzan.** *"No todos los productos tienen un ID único."*
→ El nombre es la llave. De ahí que el motor de coincidencia sea el corazón técnico, y que
la app genere **etiquetas QR de estante** imprimibles para los productos que el sistema no
tiene codificados.

## Cómo correrlo

```bash
cd app
cp .env.example .env
docker compose up --build
```

Un comando levanta Postgres 18, la API, la web y Caddy con HTTPS automático — necesario
porque el micrófono y la cámara solo funcionan en contexto seguro. Abre **https://localhost**.

**→ Documentación completa en [`app/README.md`](app/README.md)**: cómo probar cada
funcionalidad, cómo verificar el modo sin red, variables de entorno, migraciones,
troubleshooting y limitaciones declaradas.

## Cómo está hecho

```
app/
├── packages/core/    TypeScript sin dependencias, compartido cliente+servidor:
│                     normalización, matcher, parser de español, reglas de anomalía
├── apps/api/         Node 24 + Fastify + Prisma + Postgres 18
└── apps/web/         Next.js 16 + Tailwind 4 + Dexie (PWA para tablet)
```

`packages/core` es la pieza clave: **el mismo matcher y las mismas reglas corren en el
navegador sin red y en el servidor al sincronizar.** Un solo código, cero divergencia.

**Producción:** web en Vercel · API en Render (Docker) · Postgres en Neon.
El frontend reenvía `/api/*` al backend, así que el navegador ve un solo origen.

## Verificación

```bash
cd app && pnpm test        # 47 pruebas: parser de español + las 9 reglas de anomalía
cd app && pnpm test:api    # 7 pruebas: el conteo ciego no se filtra por ninguna ruta
cd app/packages/core && node --experimental-strip-types src/eval/evalFuzzy.ts
```

La última evalúa el motor de coincidencia contra los **936 nombres reales** con seis tipos
de deformación (dictado parcial, typos, letras faltantes, orden invertido):

```
GLOBAL  acc@1 = 94.3%   acc@5 = 99.4%
Latencia media por consulta: 0.10 ms
Precisión del auto-aceptado: 99.8% sobre 3517 casos
```

## Los datos

Todo sale de `datos/BODEGAS Y STOCK.xlsx`, el archivo real que entregó Colsubsidio:
**48 bodegas** listadas (solo 8 con hoja de stock — las demás se muestran igual, marcadas),
**936 artículos**, **1.405 filas**. La suciedad heredada del sistema origen no se limpió,
se manejó: 79 saldos negativos, 16 decimales sobre artículos que se cuentan por unidades,
252 filas sin número de artículo, nombres truncados a 40 caracteres y espacios no-rompibles
en medio de las palabras.

---

## Investigación previa

Este repositorio empezó como base de conocimiento y conserva el trabajo que sustenta cada
decisión de diseño.

| Ruta | Qué hay |
|---|---|
| [`reto/`](reto/) | Texto oficial del reto, logística del hackathon, beneficios de patrocinadores |
| [`lives/`](lives/) | Análisis de cada sesión en vivo con Colsubsidio + transcripciones crudas |
| [`research/`](research/) | Qué sabemos vs. qué estamos suponiendo; preguntas abiertas |
| [`datos/`](datos/) | El Excel original + perfil generado del dataset |
| [`tools/`](tools/) | Scripts para bajar y limpiar transcripciones de YouTube |
| [`archive/`](archive/) | Investigación de los retos 1 y 2, descartados |

Vale la pena leer [`lives/2026-07-22-explicacion-reto4-sVcLdIF0bjo.md`](lives/2026-07-22-explicacion-reto4-sVcLdIF0bjo.md):
de ahí salen, textuales, las restricciones de conteo ciego, trabajo sin red y ausencia de
códigos de barras.
