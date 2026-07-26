import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoHabitual } from './rangoHabitual.ts';

test('rangoHabitual: la escala habitual de cada orden de magnitud', () => {
  assert.equal(rangoHabitual(0), 'entre 1 y 9 unidades');
  assert.equal(rangoHabitual(1), 'entre 10 y 99 unidades');
  assert.equal(rangoHabitual(2), 'entre 100 y 999 unidades');
});
