/**
 * Cobertura del léxico de unidades y de la regla R3 (unidad compatible).
 *
 * R3 es la que BLOQUEA una captura cuando se dicta "kilos" para un artículo que
 * el catálogo mide en "Unidad": sin esa barrera, un dato en la escala
 * equivocada entraría como válido.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { unidadCompatible, esPalabraUnidad, buscarUnidad, buscarEnvase } from './unidades.ts';

describe('unidadCompatible (regla R3)', () => {
  test('la misma unidad es compatible', () => {
    assert.equal(unidadCompatible('Kilogram', 'Kilogram'), true);
  });

  test('unidades distintas no son compatibles', () => {
    assert.equal(unidadCompatible('Kilogram', 'Unidad'), false);
    assert.equal(unidadCompatible('Liter', 'Portion'), false);
  });
});

describe('léxico de unidades y envases', () => {
  test('reconoce palabras de unidad y de envase, ignora las normales', () => {
    assert.ok(esPalabraUnidad('kilo')); // LEXICO
    assert.ok(esPalabraUnidad('caja')); // ENVASES
    assert.equal(esPalabraUnidad('harina'), false);
  });

  test('buscarUnidad convierte gramos a kilogramos', () => {
    const u = buscarUnidad('gramos');
    assert.equal(u?.unidad, 'Kilogram');
    assert.equal(u?.factor, 0.001);
    assert.equal(buscarUnidad('harina'), null);
  });

  test('buscarEnvase distingue factor conocido de desconocido', () => {
    assert.equal(buscarEnvase('harina'), null);
    // 'docena' trae factor conocido; 'caja' existe pero sin factor (null).
    assert.equal(buscarEnvase('docena')?.factorConocido, 12);
    assert.equal(buscarEnvase('caja')?.factorConocido, null);
  });
});
