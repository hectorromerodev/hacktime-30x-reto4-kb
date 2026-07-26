/**
 * Almacenamiento de evidencia fotográfica.
 *
 * Dos implementaciones tras una sola interfaz:
 *
 *  · **Spaces** (DigitalOcean, compatible con S3) cuando hay credenciales.
 *    Es lo que se usa en producción: las fotos salen por CDN y no engordan la
 *    base de datos.
 *
 *  · **Base de datos** cuando no las hay. No es un capricho: los jueces del
 *    hackathon tienen que poder levantar el sistema con `docker compose up` y
 *    sin configurar nada. Si el arranque exigiera credenciales de un
 *    proveedor, sencillamente no podrían ejecutarlo.
 *
 * Cambiar a otro proveedor —S3 de verdad, R2, GCS— es reimplementar
 * `guardarFoto` y `leerFoto`. Nada más del sistema conoce esta decisión.
 */

import { createHash, createHmac } from 'node:crypto';
import { prisma } from './db.ts';

const ACCESO = process.env.S3_ACCESS_KEY ?? '';
const SECRETO = process.env.S3_SECRET_KEY ?? '';
const BUCKET = process.env.S3_BUCKET ?? '';
const REGION = process.env.S3_REGION ?? 'sfo3';
const HOST = process.env.S3_ENDPOINT ?? `${REGION}.digitaloceanspaces.com`;
/** Dominio público de lectura. Con CDN delante, mejor. */
const PUBLICO = process.env.S3_CDN ?? (BUCKET ? `https://${BUCKET}.${HOST}` : '');

export const usaSpaces = Boolean(ACCESO && SECRETO && BUCKET);

/** Máximo que se acepta. La web ya comprime; esto es la red de seguridad. */
export const MAX_BYTES = 3 * 1024 * 1024;

// ── Firma AWS Signature V4 ───────────────────────────────────────────────
// Se implementa a mano en vez de traer el SDK de AWS: son ~40 líneas contra
// varios megabytes de dependencia, para una sola operación de subida.

function sha256(dato: string | Buffer): string {
  return createHash('sha256').update(dato).digest('hex');
}

function hmac(clave: Buffer | string, dato: string): Buffer {
  return createHmac('sha256', clave).update(dato).digest();
}

function firmar(
  metodo: string,
  ruta: string,
  cuerpo: Buffer,
  tipoContenido: string,
): Record<string, string> {
  const ahora = new Date();
  const fechaHora = ahora.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const fecha = fechaHora.slice(0, 8);
  const hashCuerpo = sha256(cuerpo);

  const cabecerasCanonicas =
    `content-type:${tipoContenido}\n` +
    `host:${HOST}\n` +
    `x-amz-acl:public-read\n` +
    `x-amz-content-sha256:${hashCuerpo}\n` +
    `x-amz-date:${fechaHora}\n`;
  const firmadas = 'content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date';

  const solicitudCanonica = [
    metodo,
    ruta,
    '',
    cabecerasCanonicas,
    firmadas,
    hashCuerpo,
  ].join('\n');

  const alcance = `${fecha}/${REGION}/s3/aws4_request`;
  const porFirmar = [
    'AWS4-HMAC-SHA256',
    fechaHora,
    alcance,
    sha256(solicitudCanonica),
  ].join('\n');

  const clave = hmac(
    hmac(hmac(hmac(`AWS4${SECRETO}`, fecha), REGION), 's3'),
    'aws4_request',
  );
  const firma = createHmac('sha256', clave).update(porFirmar).digest('hex');

  return {
    'content-type': tipoContenido,
    'x-amz-acl': 'public-read',
    'x-amz-content-sha256': hashCuerpo,
    'x-amz-date': fechaHora,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${ACCESO}/${alcance}, ` +
      `SignedHeaders=${firmadas}, Signature=${firma}`,
  };
}

// ── Interfaz pública ─────────────────────────────────────────────────────

export interface FotoGuardada {
  /** URL para mostrarla. Absoluta si va a Spaces, relativa si va a la base. */
  url: string;
  destino: 'spaces' | 'base';
}

/**
 * @param datos    bytes de la imagen (ya comprimida por el navegador)
 * @param clientId identificador de la captura, para poder rastrearla
 */
export async function guardarFoto(
  datos: Buffer,
  tipoContenido: string,
  clientId: string,
): Promise<FotoGuardada> {
  if (datos.byteLength > MAX_BYTES) {
    throw new Error(`La imagen supera el máximo de ${MAX_BYTES / 1024 / 1024} MB.`);
  }

  const extension = tipoContenido.includes('png') ? 'png' : 'jpg';
  const nombre = `merma/${clientId}.${extension}`;

  if (usaSpaces) {
    const ruta = `/${BUCKET}/${nombre}`;
    const res = await fetch(`https://${HOST}${ruta}`, {
      method: 'PUT',
      headers: firmar('PUT', ruta, datos, tipoContenido),
      body: new Uint8Array(datos),
    });
    if (!res.ok) {
      throw new Error(`Spaces respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return { url: `${PUBLICO}/${nombre}`, destino: 'spaces' };
  }

  // Respaldo: a la base. Sirve para `docker compose up` sin credenciales.
  await prisma.evidencia.upsert({
    where: { clientId },
    create: { clientId, tipoContenido, datos },
    update: { tipoContenido, datos },
  });
  return { url: `/evidencia/${clientId}`, destino: 'base' };
}

/** Solo se usa con el respaldo en base; con Spaces la sirve el CDN. */
export async function leerFoto(
  clientId: string,
): Promise<{ datos: Buffer; tipoContenido: string } | null> {
  const fila = await prisma.evidencia.findUnique({ where: { clientId } });
  if (!fila) return null;
  return { datos: Buffer.from(fila.datos), tipoContenido: fila.tipoContenido };
}
