import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siguienteAccion, LIMITE_FALLOS, type EstadoCadena } from './dictadoSeguido.ts';

/** Cadena de dictado seguido en marcha, sin nada que resolver en pantalla. */
const enMarcha: EstadoCadena = {
  continuo: true,
  cadenaActiva: true,
  requiereAtencion: false,
  escuchando: true,
  detenidoAMano: false,
  fallosSeguidos: 0,
};

const con = (cambios: Partial<EstadoCadena>): EstadoCadena => ({ ...enMarcha, ...cambios });

test('el bug: con varios candidatos en pantalla el microfono se CIERRA', () => {
  // Era el sintoma reportado: se escaneaba/dictaba, aparecian las tarjetas
  // "¿Cual de estos es?" y el microfono seguia abierto encima de ellas. La
  // frase siguiente reemplazaba las opciones que la persona estaba leyendo.
  assert.equal(siguienteAccion(con({ requiereAtencion: true })), 'CERRAR');
});

test('cerrar por atencion NO depende del modo seguido', () => {
  // Tocar un articulo de la lista con el microfono abierto lo dejaba corriendo
  // detras de la pantalla de cantidad, donde el boton ni se dibuja.
  assert.equal(
    siguienteAccion(con({ continuo: false, cadenaActiva: false, requiereAtencion: true })),
    'CERRAR',
  );
});

test('si ya esta cerrado no se manda cerrar otra vez', () => {
  // Importa: `CERRAR` apaga el indicador, y repetirlo en cada render con un
  // articulo activo seria un setState por render.
  assert.equal(siguienteAccion(con({ requiereAtencion: true, escuchando: false })), 'NADA');
});

test('resuelto lo que pedia atencion, la cadena se reanuda sola', () => {
  // La contraparte del cierre: pausa, no muerte. Si muriera, cada articulo
  // ambiguo obligaria a volver a tocar el microfono.
  assert.equal(siguienteAccion(con({ requiereAtencion: false, escuchando: false })), 'ABRIR');
});

test('sin cadena en curso no se abre solo aunque el interruptor este encendido', () => {
  // La preferencia se recuerda entre sesiones. Sin esta guarda, entrar a la
  // pantalla abriria el microfono sin que nadie lo pidiera.
  assert.equal(
    siguienteAccion(con({ cadenaActiva: false, escuchando: false })),
    'NADA',
  );
});

test('detenido a mano no se reanuda', () => {
  assert.equal(siguienteAccion(con({ detenidoAMano: true, escuchando: false })), 'NADA');
});

test('el interruptor apagado corta la reanudacion', () => {
  assert.equal(siguienteAccion(con({ continuo: false, escuchando: false })), 'NADA');
});

test(`tras ${LIMITE_FALLOS} fallos seguidos deja de reintentar`, () => {
  // Sin tope, un microfono bloqueado o sin red entra en bucle de reinicios.
  assert.equal(
    siguienteAccion(con({ fallosSeguidos: LIMITE_FALLOS - 1, escuchando: false })),
    'ABRIR',
  );
  assert.equal(
    siguienteAccion(con({ fallosSeguidos: LIMITE_FALLOS, escuchando: false })),
    'NADA',
  );
});

test('escuchando y sin nada que resolver: no se reabre encima de si mismo', () => {
  // `start()` sobre un reconocedor vivo tira InvalidStateError, y ese error
  // contaria como fallo y terminaria apagando la cadena.
  assert.equal(siguienteAccion(enMarcha), 'NADA');
});

test('nunca queda "abierto" un estado que pide atencion', () => {
  // Barrido de las 64 combinaciones: la invariante que sostiene el arreglo es
  // que ABRIR y requiereAtencion no coexisten jamas.
  const bools = [false, true];
  let combinaciones = 0;
  for (const continuo of bools)
    for (const cadenaActiva of bools)
      for (const requiereAtencion of bools)
        for (const escuchando of bools)
          for (const detenidoAMano of bools)
            for (const fallos of [0, LIMITE_FALLOS]) {
              combinaciones++;
              const accion = siguienteAccion({
                continuo,
                cadenaActiva,
                requiereAtencion,
                escuchando,
                detenidoAMano,
                fallosSeguidos: fallos,
              });
              if (requiereAtencion) {
                assert.notEqual(accion, 'ABRIR', 'se abrio el microfono sobre un dialogo');
              }
              if (accion === 'ABRIR') {
                assert.equal(escuchando, false, 'se abrio estando ya abierto');
              }
            }
  assert.equal(combinaciones, 64);
});
