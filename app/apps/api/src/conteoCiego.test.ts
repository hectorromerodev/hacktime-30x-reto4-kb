/**
 * La prueba mas importante del proyecto.
 *
 * Colsubsidio describio el control asi: "se hace de manera ciega para asegurar
 * que la persona que esta contando cuente realmente lo que hay, no lo que el
 * sistema esta esperando."
 *
 * Que el conteo sea ciego no puede depender de que nadie olvide filtrar un
 * campo: esta prueba FALLA si `sd` aparece en cualquier respuesta que reciba el
 * dispositivo del contador. Recorre las rutas reales via `inject()`, no una
 * imitacion.
 *
 * Requiere Postgres corriendo y sembrado:
 *   docker compose up -d postgres
 *   pnpm --filter api migrate:deploy && pnpm --filter api seed
 *
 *   node --experimental-strip-types --test src/conteoCiego.test.ts
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { crearApp } from './app.ts';
import { prisma } from './db.ts';

process.env.NODE_ENV = 'test';

let app: FastifyInstance;
let cookie = '';
let cookieLider = '';
let conteoId = '';
let bodegaId = '';

before(async () => {
  app = await crearApp();

  const usuarios = await prisma.usuario.findMany({ where: { rol: 'CONTADOR' }, take: 1 });
  assert.ok(usuarios.length, 'no hay usuarios: falta correr el seed');

  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { usuarioId: usuarios[0].id, pin: usuarios[0].pin },
  });
  assert.equal(login.statusCode, 200, login.body);
  cookie = login.headers['set-cookie']!.toString().split(';')[0];

  // El reporte del lider esta protegido con `requiereLider` (devuelve `sd`).
  // Necesitamos una sesion de lider para probar ese camino sin usar la del
  // contador, que —correctamente— recibe 403.
  const lider = await prisma.usuario.findFirstOrThrow({ where: { rol: 'LIDER' } });
  const loginLider = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { usuarioId: lider.id, pin: lider.pin },
  });
  assert.equal(loginLider.statusCode, 200, loginLider.body);
  cookieLider = loginLider.headers['set-cookie']!.toString().split(';')[0];

  // La bodega con inventario mas pequena, para que la prueba sea rapida.
  const bodegas = await prisma.bodega.findMany({
    where: { tieneInventario: true },
    include: { _count: { select: { stocks: true } } },
  });
  assert.ok(bodegas.length, 'no hay bodegas con inventario: falta el seed');
  bodegaId = bodegas.sort((a, b) => a._count.stocks - b._count.stocks)[0].id;

  const conteo = await app.inject({
    method: 'POST',
    url: '/conteos',
    headers: { cookie },
    payload: { bodegaId, periodo: '2099-01' }, // periodo aparte para no chocar
  });
  assert.equal(conteo.statusCode, 200, conteo.body);
  conteoId = conteo.json().conteo.id;
});

after(async () => {
  await prisma.conteo.deleteMany({ where: { periodo: '2099-01' } });
  await app.close();
  await prisma.$disconnect();
});

/** Busca la clave `sd` en cualquier nivel de una estructura. */
function contieneClaveSd(valor: unknown, ruta = ''): string | null {
  if (valor === null || typeof valor !== 'object') return null;
  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) {
      const r = contieneClaveSd(valor[i], `${ruta}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  for (const [clave, v] of Object.entries(valor)) {
    if (clave.toLowerCase() === 'sd') return `${ruta}.${clave}`;
    const r = contieneClaveSd(v, `${ruta}.${clave}`);
    if (r) return r;
  }
  return null;
}

describe('el catalogo que descarga el contador', () => {
  test('NO contiene la cantidad esperada por el sistema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/conteos/${conteoId}/catalogo`,
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);

    const fuga = contieneClaveSd(res.json());
    assert.equal(fuga, null, `el campo sd viajo al dispositivo en ${fuga}`);

    // Tambien se revisa el texto crudo, por si llegara con otro nombre.
    assert.ok(!/"sd"\s*:/i.test(res.body), 'aparece "sd" en el cuerpo de la respuesta');
  });

  test('SI contiene exp10, que es lo que permite detectar 9 -> 90 sin red', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/conteos/${conteoId}/catalogo`,
      headers: { cookie },
    });
    const articulos = res.json().articulos as { exp10: number | null }[];
    assert.ok(articulos.length > 0);
    assert.ok('exp10' in articulos[0], 'falta exp10: la deteccion offline no funcionaria');
    // exp10 es siempre un entero pequeno o null; jamas una cantidad.
    for (const a of articulos) {
      if (a.exp10 !== null) {
        assert.ok(Number.isInteger(a.exp10), `exp10 no entero: ${a.exp10}`);
        assert.ok(a.exp10 >= 0 && a.exp10 <= 9, `exp10 fuera de rango: ${a.exp10}`);
      }
    }
  });

  test('exp10 no permite reconstruir el stock real', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/conteos/${conteoId}/catalogo`,
      headers: { cookie },
    });
    const articulos = res.json().articulos as { id: string; exp10: number | null }[];

    const stocks = await prisma.stock.findMany({
      where: { bodegaId },
      select: { articuloId: true, sd: true },
    });
    const reales = new Map(stocks.map((s) => [s.articuloId, Number(s.sd.toString())]));

    // Para cada articulo, el exp10 publicado debe ser compatible con muchos
    // valores posibles, no con uno solo: es la garantia de que publicar la
    // escala no equivale a publicar la cantidad.
    //
    // El cubo 0 es especial porque esta acotado por abajo: cubre (0, 10),
    // que incluye tanto 0,5 como 9.
    let revisados = 0;
    for (const a of articulos) {
      if (a.exp10 === null) continue;
      const real = reales.get(a.id)!;
      const min = a.exp10 === 0 ? 0 : 10 ** a.exp10;
      const max = 10 ** (a.exp10 + 1);
      // Comparacion directa: `min - Number.EPSILON` no sirve como margen
      // porque a magnitud 10 el epsilon no se puede ni representar y la resta
      // devuelve el mismo 10.
      assert.ok(real >= min && real < max, `exp10=${a.exp10} inconsistente con sd=${real}`);
      // Cuantos enteros distintos admite el cubo.
      assert.ok(Math.floor(max) - Math.ceil(min) >= 9, 'el cubo deberia admitir >=9 valores');
      revisados++;
    }
    assert.ok(revisados > 0, 'no se reviso ningun articulo');
  });
});

describe('el resto de rutas del contador', () => {
  test('la lista de capturas tampoco filtra el stock del sistema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/conteos/${conteoId}/capturas`,
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(contieneClaveSd(res.json()), null);
  });

  test('el estado del conteo muestra progreso, no cantidades', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/conteos/${conteoId}`,
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(contieneClaveSd(res.json()), null);
    const c = res.json().conteo;
    assert.ok(typeof c.progreso.contados === 'number');
    assert.ok(typeof c.progreso.total === 'number');
  });

  test('sin sesion no se entrega nada', async () => {
    const res = await app.inject({ method: 'GET', url: `/conteos/${conteoId}/catalogo` });
    assert.equal(res.statusCode, 401);
  });
});

describe('el conteo tambien es ciego ENTRE contadores', () => {
  test('/capturas/mias jamas devuelve lo capturado por otra persona', async () => {
    // Se siembran dos capturas del MISMO articulo, de dos personas distintas.
    const [yo, otro] = await prisma.usuario.findMany({ take: 2, orderBy: { nombre: 'asc' } });
    const stock = await prisma.stock.findFirst({ where: { bodegaId } });

    await prisma.captura.createMany({
      data: [
        {
          clientId: `prueba-ciego-mia-${conteoId}`,
          conteoId,
          articuloId: stock!.articuloId,
          cantidad: 11,
          unidad: 'Unidad',
          metodo: 'TECLADO',
          usuarioId: yo.id,
          capturadoEn: new Date(),
        },
        {
          clientId: `prueba-ciego-ajena-${conteoId}`,
          conteoId,
          articuloId: stock!.articuloId,
          cantidad: 999,
          unidad: 'Unidad',
          metodo: 'TECLADO',
          usuarioId: otro.id,
          capturadoEn: new Date(),
        },
      ],
      skipDuplicates: true,
    });

    // Se entra como `yo` (la sesion del before es otra: se rehace).
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usuarioId: yo.id, pin: yo.pin },
    });
    const galleta = login.headers['set-cookie']!.toString().split(';')[0];

    const res = await app.inject({
      method: 'GET',
      url: `/conteos/${conteoId}/capturas/mias`,
      headers: { cookie: galleta },
    });
    assert.equal(res.statusCode, 200);

    const cuerpo = res.body;
    const capturas = res.json().capturas as { clientId: string; cantidad: number }[];

    assert.ok(
      capturas.some((c) => c.clientId === `prueba-ciego-mia-${conteoId}`),
      'deberia devolver lo propio',
    );
    assert.ok(
      !capturas.some((c) => c.clientId === `prueba-ciego-ajena-${conteoId}`),
      'FUGA: devolvio la captura de otro contador',
    );
    // El 999 del otro no puede aparecer ni siquiera de refilon.
    assert.ok(!cuerpo.includes('999'), 'FUGA: la cantidad ajena viajo en la respuesta');
  });
});

describe('cerrar sesion', () => {
  test('la cookie se borra con los MISMOS atributos con que se creo', async () => {
    // Si no coinciden, el navegador ignora el borrado y el boton Salir no hace
    // nada: una cookie NO segura no puede sobrescribir una segura.
    const usuario = await prisma.usuario.findFirstOrThrow();

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { usuarioId: usuario.id, pin: usuario.pin },
    });
    const alCrear = login.headers['set-cookie']!.toString();

    const logout = await app.inject({ method: 'POST', url: '/auth/logout' });
    const alBorrar = logout.headers['set-cookie']!.toString();

    const tiene = (cookie: string, atributo: string) =>
      cookie.toLowerCase().includes(atributo.toLowerCase());

    for (const atributo of ['Path=/', 'HttpOnly', 'SameSite=Lax']) {
      assert.equal(
        tiene(alBorrar, atributo),
        tiene(alCrear, atributo),
        `el atributo ${atributo} no coincide entre crear y borrar`,
      );
    }
    // `Secure` es el que rompia en produccion.
    assert.equal(
      tiene(alBorrar, 'Secure'),
      tiene(alCrear, 'Secure'),
      'Secure no coincide: el navegador descartaria el borrado',
    );
    // Y la cookie de borrado debe vencer de inmediato.
    assert.ok(/max-age=0|expires=thu, 01 jan 1970/i.test(alBorrar));
  });
});

describe('el reporte del lider SI muestra el sistema (el conteo ya termino)', () => {
  test('ahi la comparacion es el objetivo, no una fuga', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/conteos/${conteoId}/reporte`,
      headers: { cookie: cookieLider },
    });
    assert.equal(res.statusCode, 200);
    // La duena del negocio pidio exactamente esto: "cuanto subi y cuanto me
    // cargo al sistema". Es una pantalla de cierre, no de captura.
    assert.ok('resumen' in res.json());
    assert.ok(Array.isArray(res.json().diferencias));
  });

  test('un contador NO puede pedir el reporte: seria una fuga del sistema', async () => {
    // El reporte devuelve `sd`. Si un contador pudiera pedirlo a mitad del
    // conteo, veria lo que el sistema espera y el conteo dejaria de ser ciego.
    const res = await app.inject({
      method: 'GET',
      url: `/conteos/${conteoId}/reporte`,
      headers: { cookie },
    });
    assert.equal(res.statusCode, 403, 'el contador deberia recibir 403, no el reporte');
  });
});
