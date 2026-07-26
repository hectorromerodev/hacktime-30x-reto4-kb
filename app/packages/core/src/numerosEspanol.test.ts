/**
 * Cobertura de los caminos de dígitos y del reconocedor de palabras-número.
 *
 * Estos dos son la puerta de entrada del parser: si `parseDigitos` lee mal la
 * convención colombiana (punto = miles, coma = decimal) o `esPalabraNumero`
 * deja pasar una palabra normal como número, todo lo que viene después falla.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseDigitos, esPalabraNumero } from './numerosEspanol.ts';

describe('parseDigitos: convención colombiana', () => {
  test('el punto es separador de miles', () => {
    assert.equal(parseDigitos('1.250'), 1250);
    assert.equal(parseDigitos('12.500'), 12500);
  });

  test('miles con decimal de coma', () => {
    assert.equal(parseDigitos('1.250,75'), 1250.75);
  });

  test('coma decimal simple y entero pelado', () => {
    assert.equal(parseDigitos('5,5'), 5.5);
    assert.equal(parseDigitos('50'), 50);
  });

  test('lo que no es número devuelve null', () => {
    assert.equal(parseDigitos('harina'), null);
    assert.equal(parseDigitos(''), null);
  });
});

describe('esPalabraNumero reconoce cada léxico', () => {
  test('unidades, decenas, centenas, multiplicadores, fracciones y dígitos', () => {
    assert.ok(esPalabraNumero('cinco')); // UNIDADES
    assert.ok(esPalabraNumero('treinta')); // DECENAS
    assert.ok(esPalabraNumero('doscientos')); // CENTENAS
    assert.ok(esPalabraNumero('mil')); // MULTIPLICADORES
    assert.ok(esPalabraNumero('medio')); // FRACCIONES
    assert.ok(esPalabraNumero('900')); // dígitos
  });

  test('una palabra normal no es número', () => {
    assert.equal(esPalabraNumero('harina'), false);
  });
});
