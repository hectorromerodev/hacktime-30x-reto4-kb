/**
 * Cola de salida y sincronizacion.
 *
 * Contrato de idempotencia: el `clientId` se genera en el dispositivo ANTES de
 * tener red. El servidor inserta por esa llave, asi que reenviar un lote nunca
 * duplica. Reintentar es gratis, que es justo lo que hace falta cuando la
 * tablet recupera senal a mitad de un almacen.
 */

import { db, type CapturaLocal } from './db.ts';
import { api } from './api.ts';

interface RespuestaSync {
  aceptadas: string[];
  duplicadas: string[];
  rechazadas: { clientId: string; motivo: string }[];
  conflictos: { clientId: string; articuloId: string; otroContador: string }[];
  verificar: { clientId: string; articuloId: string; mensaje: string }[];
}

const TAMANO_LOTE = 50;

let sincronizando = false;

/**
 * Estado real de la conexión con el servidor.
 *
 * `navigator.onLine` solo dice si la tablet tiene una interfaz de red activa:
 * responde `true` estando conectada a un wifi de bodega que no llega a
 * ninguna parte. Mostrar "En línea" ahí sería mentirle al contador justo
 * cuando más importa. Este estado se deduce de si las sincronizaciones de
 * verdad llegan.
 */
export type EstadoConexion = 'EN_LINEA' | 'SIN_RED' | 'SERVIDOR_INALCANZABLE';

let ultimoIntentoFallo = false;
const oyentes = new Set<(e: EstadoConexion) => void>();

export function estadoConexion(): EstadoConexion {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'SIN_RED';
  return ultimoIntentoFallo ? 'SERVIDOR_INALCANZABLE' : 'EN_LINEA';
}

function marcarConexion(fallo: boolean) {
  if (ultimoIntentoFallo === fallo) return;
  ultimoIntentoFallo = fallo;
  const e = estadoConexion();
  oyentes.forEach((f) => f(e));
}

/** Se notifica cada vez que cambia el estado de conexión. */
export function alCambiarConexion(f: (e: EstadoConexion) => void): () => void {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

/**
 * Guarda la captura localmente y la encola. La UI no espera a la red.
 *
 * @param foto evidencia opcional, ya comprimida. Se guarda aparte y se sube
 *             antes que el lote; la merma queda registrada aunque la imagen
 *             tarde o falle.
 */
export async function capturar(
  captura: CapturaLocal,
  foto?: { datos: string; tipoContenido: string },
) {
  await db.transaction('rw', db.capturas, db.cola, db.fotos, async () => {
    await db.capturas.put(captura);
    await db.cola.put({
      clientId: captura.clientId,
      conteoId: captura.conteoId,
      payload: JSON.stringify(paraServidor(captura)),
      intentos: 0,
      creadoEn: new Date().toISOString(),
    });
    if (foto) {
      await db.fotos.put({
        clientId: captura.clientId,
        datos: foto.datos,
        tipoContenido: foto.tipoContenido,
        creadoEn: new Date().toISOString(),
      });
    }
  });
  // Se intenta enviar de una vez, pero sin bloquear al contador.
  void sincronizar(captura.conteoId);
}

function paraServidor(c: CapturaLocal) {
  return {
    clientId: c.clientId,
    articuloId: c.articuloId,
    cantidad: c.cantidad,
    unidad: c.unidad,
    unidadDicha: c.unidadDicha ?? null,
    metodo: c.metodo,
    textoCrudo: c.textoCrudo ?? null,
    scoreMatch: c.scoreMatch ?? null,
    anomalias: c.anomalias,
    motivoConfirmacion: c.motivoConfirmacion ?? null,
    capturadoEn: c.capturadoEn,
    tipo: c.tipo ?? 'CONTEO',
    motivoMerma: c.motivoMerma ?? null,
    incluidoEnConteo: c.incluidoEnConteo ?? null,
    fotoUrl: c.fotoUrl ?? null,
  };
}

/**
 * Sube las fotos pendientes y deja la URL en su captura.
 *
 * Va ANTES de mandar el lote, para que la captura viaje ya con su evidencia.
 * Si una foto falla no se detiene nada: la merma se registra igual y la foto
 * se reintenta en la siguiente vuelta. Perder la evidencia es malo; perder el
 * registro de la baja es peor.
 */
async function subirFotosPendientes(conteoId: string) {
  const pendientes = await db.fotos.toArray();
  if (pendientes.length === 0) return;

  for (const foto of pendientes) {
    const captura = await db.capturas.get(foto.clientId);
    if (!captura || captura.conteoId !== conteoId) continue;

    try {
      const res = await api<{ url: string }>('/evidencia', {
        method: 'POST',
        body: JSON.stringify({
          clientId: foto.clientId,
          tipoContenido: foto.tipoContenido,
          datos: foto.datos,
        }),
      });
      await db.transaction('rw', db.capturas, db.cola, db.fotos, async () => {
        await db.capturas.put({ ...captura, fotoUrl: res.url });
        // La captura encolada tiene que salir con la URL ya puesta.
        const enCola = await db.cola.get(foto.clientId);
        if (enCola) {
          await db.cola.put({
            ...enCola,
            payload: JSON.stringify({ ...JSON.parse(enCola.payload), fotoUrl: res.url }),
          });
        }
        await db.fotos.delete(foto.clientId);
      });
    } catch {
      // Sin red o error del servidor: se reintenta luego.
    }
  }
}

/** Vacia la cola. Silenciosa: sin red simplemente no hace nada. */
export async function sincronizar(conteoId: string): Promise<boolean> {
  if (sincronizando) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  sincronizando = true;
  try {
    await subirFotosPendientes(conteoId);

    for (;;) {
      const lote = await db.cola.where('conteoId').equals(conteoId).limit(TAMANO_LOTE).toArray();
      if (lote.length === 0) return true;

      const capturas = lote.map((e) => JSON.parse(e.payload));
      let res: RespuestaSync;
      try {
        res = await api<RespuestaSync>(`/conteos/${conteoId}/capturas`, {
          method: 'POST',
          body: JSON.stringify({ capturas }),
        });
      } catch {
        // Sin red o servidor caido: se queda en la cola y se reintenta luego.
        await db.cola.bulkPut(lote.map((e) => ({ ...e, intentos: e.intentos + 1 })));
        marcarConexion(true);
        return false;
      }
      marcarConexion(false);

      // Aceptadas y duplicadas salen de la cola por igual: en ambos casos el
      // servidor ya las tiene. Tratar "duplicada" como error dejaria la cola
      // atascada para siempre tras un reintento.
      const resueltas = [...res.aceptadas, ...res.duplicadas, ...res.rechazadas.map((r) => r.clientId)];

      await db.transaction('rw', db.capturas, db.cola, async () => {
        await db.cola.bulkDelete(resueltas);
        for (const id of [...res.aceptadas, ...res.duplicadas]) {
          const c = await db.capturas.get(id);
          if (c) await db.capturas.put({ ...c, sincronizada: true });
        }
        for (const v of res.verificar) {
          const c = await db.capturas.get(v.clientId);
          if (c) await db.capturas.put({ ...c, requiereVerificacion: v.mensaje });
        }
        for (const k of res.conflictos) {
          const c = await db.capturas.get(k.clientId);
          if (c) await db.capturas.put({ ...c, enConflicto: true });
        }
        // Rechazadas: se marcan para que el contador las vea, no se borran.
        for (const r of res.rechazadas) {
          const c = await db.capturas.get(r.clientId);
          if (c) await db.capturas.put({ ...c, requiereVerificacion: `Rechazada: ${r.motivo}` });
        }
      });

      if (lote.length < TAMANO_LOTE) return true;
    }
  } finally {
    sincronizando = false;
  }
}

/** Cuantas capturas esperan envio. Alimenta el indicador de la cabecera. */
export async function pendientes(conteoId: string): Promise<number> {
  return db.cola.where('conteoId').equals(conteoId).count();
}

/** Reintenta al volver la red y cada 20 s como red de seguridad. */
export function arrancarSincronizacion(conteoId: string): () => void {
  const alVolver = () => void sincronizar(conteoId);
  window.addEventListener('online', alVolver);
  const intervalo = setInterval(alVolver, 20_000);
  void sincronizar(conteoId);

  return () => {
    window.removeEventListener('online', alVolver);
    clearInterval(intervalo);
  };
}
