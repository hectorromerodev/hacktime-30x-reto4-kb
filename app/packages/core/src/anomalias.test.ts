import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluarAnomalias,
  bloquea,
  guardaDirecto,
  calcularExp10,
  ordenDeMagnitud,
  type ContextoAnomalia,
} from './anomalias.ts';

/** Contexto base: un articulo en kilogramos cuyo stock ronda las decenas. */
function ctx(parcial: Partial<ContextoAnomalia> = {}): ContextoAnomalia {
  return {
    cantidad: 10,
    unidadCapturada: 'Kilogram',
    unidadCatalogo: 'Kilogram',
    nombreArticulo: 'HARINA DE TRIGO',
    exp10: 1, // el sistema espera algo del orden de 10..99
    ...parcial,
  };
}

const codigos = (c: ContextoAnomalia) => evaluarAnomalias(c).map((a) => a.codigo);

describe('exp10: el dato que reemplaza a SD', () => {
  test('es el orden de magnitud, no la cantidad', () => {
    assert.equal(calcularExp10(9), 0);
    assert.equal(calcularExp10(30.59), 1);
    assert.equal(calcularExp10(423), 2);
    assert.equal(calcularExp10(41500), 4);
  });

  test('un stock no positivo no tiene orden de magnitud', () => {
    // El archivo real trae 79 saldos negativos heredados del sistema.
    assert.equal(calcularExp10(0), null);
    assert.equal(calcularExp10(-295), null);
  });

  test('un stock fraccionario cae en el cubo cero, no en uno negativo', () => {
    // Sin el tope inferior, 0,5 daba exp10 = -1 mientras que contar 0,5 da
    // orden 0: la resta valia 1 y R8 alarmaba cada vez que alguien contaba
    // BIEN un articulo de stock fraccionario. El archivo real trae 325 filas
    // con decimales, asi que habria sido ruido constante.
    assert.equal(calcularExp10(0.5), 0);
    assert.equal(calcularExp10(0.001), 0);
    assert.equal(ordenDeMagnitud(0.5), calcularExp10(0.5));
  });

  test('contar exacto un articulo de stock fraccionario no alarma', () => {
    const a = evaluarAnomalias(
      ctx({ cantidad: 0.5, exp10: calcularExp10(0.5), nombreArticulo: 'CANELA EN POLVO' }),
    );
    assert.ok(
      !a.some((x) => x.codigo === 'R8_SALTO_DE_MAGNITUD'),
      `alarma falsa: ${a.map((x) => x.codigo).join(',')}`,
    );
  });

  test('no permite reconstruir la cantidad esperada', () => {
    // Todo el rango 10..99 comparte el mismo exp10: quien lo viera solo
    // aprende la escala, nunca el numero. Eso es lo que mantiene ciego el
    // conteo aun teniendo el dato en el dispositivo.
    const mismos = [10, 11, 42, 78, 99].map(calcularExp10);
    assert.deepEqual(new Set(mismos), new Set([1]));
  });
});

describe('R8 — el salto de magnitud (el caso 9 -> 90 del brief)', () => {
  test('capturar 900 donde se esperan decenas dispara verificacion', () => {
    assert.ok(codigos(ctx({ cantidad: 900 })).includes('R8_SALTO_DE_MAGNITUD'));
  });

  test('capturar 9 donde se esperan decenas tambien lo dispara', () => {
    assert.ok(codigos(ctx({ cantidad: 9 })).includes('R8_SALTO_DE_MAGNITUD'));
  });

  test('una cantidad de la escala esperada pasa sin molestar', () => {
    assert.ok(guardaDirecto(evaluarAnomalias(ctx({ cantidad: 42 }))));
  });

  test('el mensaje NUNCA revela la cantidad esperada', () => {
    // ACEITE en la bodega de demo tiene SD = 30.59 -> exp10 = 1.
    const a = evaluarAnomalias(ctx({ cantidad: 900, exp10: 1, nombreArticulo: 'ACEITE' }));
    const r8 = a.find((x) => x.codigo === 'R8_SALTO_DE_MAGNITUD')!;
    const texto = r8.mensaje + r8.opciones!.map((o) => o.etiqueta).join(' ');

    assert.ok(!texto.includes('30'), `se filtro el stock esperado: ${texto}`);
    assert.ok(!texto.includes('31'), `se filtro el stock esperado: ${texto}`);
    // Solo aparece lo que la propia persona capturo, y su vecino de un digito.
    assert.ok(texto.includes('900'));
  });

  test('ofrece el vecino de un digito solo si cae en la escala esperada', () => {
    const conVecino = evaluarAnomalias(ctx({ cantidad: 900, exp10: 1 }));
    const r8 = conVecino.find((x) => x.codigo === 'R8_SALTO_DE_MAGNITUD')!;
    assert.ok(r8.opciones!.some((o) => o.accion === 'CORREGIR_A' && o.valor === 90));

    // 9000 con escala esperada de decenas: 900 tampoco es de la escala, asi
    // que no se sugiere nada — sugerirlo seria inventar una pista falsa.
    const sinVecino = evaluarAnomalias(ctx({ cantidad: 9000, exp10: 1 }));
    const r8b = sinVecino.find((x) => x.codigo === 'R8_SALTO_DE_MAGNITUD')!;
    assert.ok(!r8b.opciones!.some((o) => o.accion === 'CORREGIR_A'));
  });

  test('sin exp10 no se inventa la regla', () => {
    // Articulo sin stock previo o con saldo negativo: no hay escala conocida.
    assert.ok(!codigos(ctx({ cantidad: 900, exp10: null })).includes('R8_SALTO_DE_MAGNITUD'));
  });

  test('la accion primaria es volver a teclear, no aceptar', () => {
    const a = evaluarAnomalias(ctx({ cantidad: 900 }));
    const r8 = a.find((x) => x.codigo === 'R8_SALTO_DE_MAGNITUD')!;
    assert.equal(r8.opciones![0].accion, 'RETECLEAR');
  });
});

describe('reglas que no necesitan conocer el stock', () => {
  test('R2 — una cantidad negativa se bloquea', () => {
    const a = evaluarAnomalias(ctx({ cantidad: -5 }));
    assert.ok(a.some((x) => x.codigo === 'R2_NEGATIVO'));
    assert.ok(bloquea(a), 'debe impedir guardar');
  });

  test('R1 — decimal en un articulo que se cuenta por unidades', () => {
    const c = ctx({ cantidad: 2.5, unidadCapturada: 'Unidad', unidadCatalogo: 'Unidad' });
    const a = evaluarAnomalias(c);
    assert.ok(a.some((x) => x.codigo === 'R1_DECIMAL_EN_UNIDAD'));
    // Ofrece redondear, que es lo que suele querer decir el contador.
    const r1 = a.find((x) => x.codigo === 'R1_DECIMAL_EN_UNIDAD')!;
    assert.ok(r1.opciones!.some((o) => o.accion === 'CORREGIR_A' && o.valor === 3));
  });

  test('R1 — un decimal en kilogramos es perfectamente normal', () => {
    assert.ok(!codigos(ctx({ cantidad: 12.5 })).includes('R1_DECIMAL_EN_UNIDAD'));
  });

  test('R3 — unidad discordante se bloquea (el caso kilos vs litros)', () => {
    const c = ctx({ unidadCapturada: 'Liter', unidadCatalogo: 'Kilogram' });
    const a = evaluarAnomalias(c);
    assert.ok(a.some((x) => x.codigo === 'R3_UNIDAD_DISCORDANTE'));
    assert.ok(bloquea(a));
    // El mensaje dice en que unidad SI se cuenta.
    assert.ok(a[0].mensaje.includes('kilogramos'));
  });

  test('R5 — el cero se confirma, no se bloquea', () => {
    const a = evaluarAnomalias(ctx({ cantidad: 0 }));
    assert.ok(a.some((x) => x.codigo === 'R5_CERO_EXPLICITO'));
    assert.ok(!bloquea(a), 'declarar agotado es valido, solo se confirma');
  });

  test('R6 — cantidad absurda en terminos absolutos', () => {
    assert.ok(codigos(ctx({ cantidad: 250_000, exp10: null })).includes('R6_MAGNITUD_ABSURDA'));
  });

  test('R4 — el matcher dudoso pide confirmar el articulo', () => {
    assert.ok(codigos(ctx({ scoreMatch: 0.5, scoreSegundo: 0.1 })).includes('R4_MATCH_DEBIL'));
    // Margen estrecho entre el primero y el segundo: tambien es dudoso.
    assert.ok(codigos(ctx({ scoreMatch: 0.9, scoreSegundo: 0.88 })).includes('R4_MATCH_DEBIL'));
    // Coincidencia clara y con margen: no molesta.
    assert.ok(!codigos(ctx({ scoreMatch: 0.95, scoreSegundo: 0.4 })).includes('R4_MATCH_DEBIL'));
  });
});

describe('R7 — conteo simultaneo entre personas', () => {
  test('avisa quien lo conto pero NO cuanto conto', () => {
    const a = evaluarAnomalias(ctx({ yaContadoPor: 'Luis Ramírez', minutosDesdeConteoPrevio: 4 }));
    const r7 = a.find((x) => x.codigo === 'R7_DUPLICADO_EN_SESION')!;
    assert.ok(r7.mensaje.includes('Luis Ramírez'));
    // El conteo tambien es ciego ENTRE contadores: ese es el control de
    // auditoria (uno cuenta, otro recuenta sin ver el resultado del primero).
    assert.ok(!/\d+\s*(kg|kilogramo|unidad)/i.test(r7.mensaje));
  });

  test('nunca suma en silencio: obliga a decidir', () => {
    const a = evaluarAnomalias(ctx({ yaContadoPor: 'Ana Gómez' }));
    const r7 = a.find((x) => x.codigo === 'R7_DUPLICADO_EN_SESION')!;
    const acciones = r7.opciones!.map((o) => o.accion);
    assert.ok(acciones.includes('RECUENTO'), 'debe poder reemplazar');
    assert.ok(acciones.includes('SUMAR'), 'debe poder sumar si es otra ubicacion');
  });
});

describe('R9 — envase sin factor de conversion', () => {
  test('no se inventa la equivalencia de una caja', () => {
    const a = evaluarAnomalias(ctx({ envaseSinFactor: 'caja' }));
    assert.ok(a.some((x) => x.codigo === 'R9_ENVASE_SIN_FACTOR'));
  });
});

describe('ordenDeMagnitud', () => {
  test('las cantidades menores que uno caen en el orden cero', () => {
    assert.equal(ordenDeMagnitud(0.5), 0);
    assert.equal(ordenDeMagnitud(1), 0);
    assert.equal(ordenDeMagnitud(9.9), 0);
    assert.equal(ordenDeMagnitud(10), 1);
  });
});
