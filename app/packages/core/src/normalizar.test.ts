/**
 * Tests unitarios: normalización de nombres del catálogo.
 *
 * La suciedad del Excel real (espacios no-rompibles, prefijos de clasificación
 * interna, sufijos entre paréntesis, acentos inconsistentes) NO se puede
 * arreglar en el archivo origen. Estas funciones convierten todo a una forma
 * comparable y extraen las piezas útiles de desempate.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { quitarAcentos, descomponerNombre, normalizar, tokenizar } from './normalizar.ts';

describe('quitarAcentos', () => {
  test('quita tildes', () => {
    assert.equal(quitarAcentos('árbol'), 'arbol');
    assert.equal(quitarAcentos('canción'), 'cancion');
  });

  test('la eñe se colapsa a n', () => {
    // A propósito: nadie dicta ni teclea la tilde. El catálogo pasa por
    // esta misma función, así que ambas formas terminan igual.
    assert.equal(quitarAcentos('JALAPEÑOS'), 'JALAPENOS');
  });

  test('no altera texto sin acentos', () => {
    assert.equal(quitarAcentos('HARINA'), 'HARINA');
  });

  test('maneja string vacío y null', () => {
    assert.equal(quitarAcentos(''), '');
    assert.equal(quitarAcentos(null as unknown as string), '');
  });
});

describe('normalizar', () => {
  test('mayúsculas y espacios colapsados', () => {
    assert.equal(normalizar('Harina de Trigo'), 'HARINA DE TRIGO');
    assert.equal(normalizar('  doble   espacio '), 'DOBLE ESPACIO');
  });

  test('espacios no-rompibles (U+00A0) se convierten a espacio', () => {
    // El Excel real trae estos caracteres tanto al inicio como en medio
    // de tokens. Borrarlos pegaría palabras; convertirlos las separa bien.
    const conNbsp = '\u00a0BOLSA BLANCA RESD APROV\u00a090X110 CAL 2\u00a0';
    assert.equal(normalizar(conNbsp), 'BOLSA BLANCA RESD APROV 90X110 CAL 2');
  });

  test('puntuación se reemplaza por espacio', () => {
    assert.equal(normalizar('ARCHIVADOR FUELLE OFICIO PLAS.13 BOLSILL'), 'ARCHIVADOR FUELLE OFICIO PLAS 13 BOLSILL');
    assert.equal(normalizar('ACEITE (PA)'), 'ACEITE PA');
  });

  test('texto vacío da cadena vacía', () => {
    assert.equal(normalizar(''), '');
  });
});

describe('descomponerNombre', () => {
  test('extrae prefijo de clasificación tipo AFVT)', () => {
    const r = descomponerNombre('AFVT) ANTIMICROBIANO FRUTAS Y VERDURAS');
    assert.equal(r.prefijo, 'AFVT');
    assert.ok(r.normalizado.includes('ANTIMICROBIANO'));
  });

  test('extrae sufijo entre paréntesis al final', () => {
    const r = descomponerNombre('PORCION CADERA X 180 GR (PA)');
    assert.equal(r.calificador, 'PA');
    assert.ok(r.normalizado.includes('PORCION CADERA X 180 GR'));
  });

  test('sin prefijo ni sufijo', () => {
    const r = descomponerNombre('ACEITE');
    assert.equal(r.prefijo, null);
    assert.equal(r.calificador, null);
    assert.equal(r.normalizado, 'ACEITE');
  });

  test('nombre completo sin prefijo ni sufijo', () => {
    const r = descomponerNombre('PORCION DE CADERA X 100 GRS');
    assert.equal(r.prefijo, null);
    assert.equal(r.calificador, null);
    assert.equal(r.normalizado, 'PORCION DE CADERA X 100 GRS');
  });
});

describe('tokenizar', () => {
  test('separa por espacios ignorando vacíos', () => {
    const tokens = tokenizar('HARINA DE TRIGO');
    assert.deepEqual(tokens, ['HARINA', 'DE', 'TRIGO']);
  });

  test('cadena vacía da array vacío', () => {
    assert.deepEqual(tokenizar(''), []);
  });
});
