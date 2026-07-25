import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnunciado } from './parseEspanol.ts';

/** Atajo: cantidad total + unidad + primera variante de nombre. */
function p(texto: string) {
  const r = parseEnunciado(texto);
  return {
    cantidad: r.cantidadTotal,
    unidad: r.unidad,
    producto: r.variantesProducto[0] ?? '',
    confianza: r.confianza,
    r,
  };
}

describe('cantidades y unidades basicas', () => {
  test('el ejemplo textual del brief', () => {
    const r = p('cinco kilos de harina');
    assert.equal(r.cantidad, 5);
    assert.equal(r.unidad, 'Kilogram');
    assert.equal(r.producto, 'harina');
  });

  test('numero en digitos', () => {
    const r = p('12 unidades de gaseosa');
    assert.equal(r.cantidad, 12);
    assert.equal(r.unidad, 'Unidad');
  });

  test('producto antes de la cantidad', () => {
    const r = p('harina de trigo treinta kilos');
    assert.equal(r.cantidad, 30);
    assert.equal(r.unidad, 'Kilogram');
    assert.equal(r.producto, 'harina de trigo');
  });

  test('decenas compuestas con y', () => {
    assert.equal(p('treinta y cinco litros de aceite').cantidad, 35);
    assert.equal(p('cuarenta y dos unidades').cantidad, 42);
  });

  test('centenas y millares', () => {
    assert.equal(p('doscientos cincuenta kilos').cantidad, 250);
    assert.equal(p('dos mil unidades').cantidad, 2000);
    assert.equal(p('mil quinientos gramos').cantidad, 1.5); // convertido a kg
  });

  test('la coma decimal colombiana', () => {
    assert.equal(p('2,5 kilos de arroz').cantidad, 2.5);
  });
});

describe('fracciones', () => {
  test('medio kilo', () => {
    const r = p('medio kilo de arroz');
    assert.equal(r.cantidad, 0.5);
    assert.equal(r.unidad, 'Kilogram');
    assert.equal(r.producto, 'arroz');
  });

  test('fraccion despues de la unidad', () => {
    const r = p('dos kilos y medio de azucar');
    assert.equal(r.cantidad, 2.5);
    assert.equal(r.unidad, 'Kilogram');
  });

  test('fraccion antes de la unidad', () => {
    assert.equal(p('dos y medio kilos de azucar').cantidad, 2.5);
  });

  test('tres cuartos', () => {
    assert.equal(p('tres cuartos de litro').cantidad, 0.75);
  });
});

describe('conversion de unidades: el error que el brief nombra', () => {
  test('gramos se convierten a kilogramos, no se confunden', () => {
    const cincoKilos = p('cinco kilos de harina');
    const cincoGramos = p('cinco gramos de harina');
    assert.equal(cincoKilos.cantidad, 5);
    assert.equal(cincoGramos.cantidad, 0.005);
    // Misma unidad de catalogo, cantidades separadas por 3 ordenes de magnitud.
    assert.equal(cincoKilos.unidad, cincoGramos.unidad);
    assert.notEqual(cincoKilos.cantidad, cincoGramos.cantidad);
  });

  test('quinientos gramos son medio kilo', () => {
    assert.equal(p('quinientos gramos de mantequilla').cantidad, 0.5);
  });

  test('mililitros a litros', () => {
    assert.equal(p('750 mililitros de aceite').cantidad, 0.75);
  });

  test('se avisa cuando hubo conversion', () => {
    const r = p('quinientos gramos de sal');
    assert.ok(r.r.avisos.some((a) => a.includes('gramos')));
  });
});

describe('conteos compuestos y envases', () => {
  test('una caja y tres unidades: dos terminos', () => {
    const r = p('una caja y tres unidades de gaseosa');
    assert.equal(r.r.terminos.length, 2);
    assert.equal(r.r.terminos[0].envase, 'caja');
    assert.equal(r.r.terminos[0].factorEnvaseDesconocido, true);
    assert.equal(r.r.terminos[1].cantidad, 3);
    assert.equal(r.r.terminos[1].unidad, 'Unidad');
    assert.equal(r.producto, 'gaseosa');
  });

  test('no se inventa el factor de una caja', () => {
    const r = p('tres cajas de leche');
    assert.equal(r.r.terminos[0].factorEnvaseDesconocido, true);
    assert.equal(r.cantidad, null, 'sin factor no se puede totalizar');
    assert.ok(r.r.avisos.some((a) => a.includes('factor de conversion') || a.includes('factor')));
  });

  test('docena si tiene factor conocido', () => {
    const r = p('dos docenas de huevos');
    assert.equal(r.cantidad, 24);
    assert.equal(r.unidad, 'Unidad');
  });
});

describe('robustez ante dictado real', () => {
  test('muletillas al inicio', () => {
    const r = p('eh hay cinco kilos de harina');
    assert.equal(r.cantidad, 5);
    assert.equal(r.producto, 'harina');
  });

  test('acentos y mayusculas indistintos', () => {
    const r = p('CINCO KILOS DE AZÚCAR');
    assert.equal(r.cantidad, 5);
    assert.equal(r.producto, 'azucar');
  });

  test('sin unidad dicha: cantidad sola', () => {
    const r = p('nueve cajas');
    assert.equal(r.r.terminos[0].cantidadDicha, 9);
    assert.equal(r.r.terminos[0].envase, 'caja' === r.r.terminos[0].envase ? 'caja' : 'cajas');
  });

  test('la ambiguedad 30 vs 50 se resuelve en la palabra, no en el trazo', () => {
    assert.equal(p('treinta unidades').cantidad, 30);
    assert.equal(p('cincuenta unidades').cantidad, 50);
  });

  test('texto sin numero devuelve confianza baja', () => {
    const r = p('harina de trigo');
    assert.equal(r.cantidad, null);
    assert.ok(r.confianza < 0.6, `confianza ${r.confianza} deberia ser baja`);
  });

  test('el nombre conserva los conectores internos', () => {
    assert.equal(p('cinco kilos de harina de trigo').producto, 'harina de trigo');
  });

  test('variante alterna cuando la palabra de envase era parte del nombre', () => {
    // "un balde plastico": 'balde' se lee como envase, pero el catalogo tiene
    // "BALDE PLASTICO 10 LTS". La segunda variante lo recupera.
    const r = parseEnunciado('un balde plastico');
    assert.ok(
      r.variantesProducto.some((v) => v.includes('balde')),
      `variantes: ${JSON.stringify(r.variantesProducto)}`,
    );
  });
});
