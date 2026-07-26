import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoHabitual } from './rangoHabitual.ts';

test('rangoHabitual: la escala habitual de cada orden de magnitud', () => {
  assert.equal(rangoHabitual(0, 'Unidad'), 'entre 1 y 9 unidades');
  assert.equal(rangoHabitual(1, 'Unidad'), 'entre 10 y 99 unidades');
  assert.equal(rangoHabitual(2, 'Unidad'), 'entre 100 y 999 unidades');
});

test('usa la unidad del artículo, no "unidades" para todo', () => {
  // El aviso explica una anomalía: decir "unidades" sobre un artículo medido
  // en litros seria sembrar la confusion de unidades que la app combate.
  assert.equal(rangoHabitual(1, 'Liter'), 'entre 10 y 99 litros');
  assert.equal(rangoHabitual(1, 'Kilogram'), 'entre 10 y 99 kilogramos');
  assert.equal(rangoHabitual(2, 'Portion'), 'entre 100 y 999 porciones');
});

test('sin unidad conocida se omite el sustantivo, no se inventa', () => {
  assert.equal(rangoHabitual(1), 'entre 10 y 99');
});

test('nunca revela una cantidad concreta: el rango siempre admite varios valores', () => {
  for (let e = 0; e <= 5; e++) {
    const texto = rangoHabitual(e, 'Unidad');
    const [inf, sup] = [10 ** e, 10 ** (e + 1) - 1];
    assert.ok(sup - inf >= 8, `exp10=${e} deja un rango demasiado estrecho`);
    assert.ok(texto.includes('entre'), 'debe expresarse como rango');
  }
});
