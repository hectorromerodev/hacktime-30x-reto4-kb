/**
 * Cliente HTTP. Todas las llamadas van con cookie de sesion.
 *
 * En Docker la web y la API comparten origen via Caddy (`/api/...`), asi que
 * no hay CORS. En desarrollo o con despliegue partido se apunta con
 * NEXT_PUBLIC_API_URL.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ErrorApi extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  // El content-type SOLO va cuando hay cuerpo.
  //
  // Anunciar `application/json` en una peticion sin cuerpo hace que Fastify
  // responda 400 (FST_ERR_CTP_EMPTY_JSON_BODY). Es lo que rompia el boton
  // Salir: el POST a /auth/logout no lleva cuerpo, nunca llegaba a ejecutarse
  // y la sesion seguia viva. No se vio con curl porque curl no manda esa
  // cabecera por su cuenta.
  const tieneCuerpo = init?.body != null;

  const res = await fetch(`${BASE}${ruta}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(tieneCuerpo ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let mensaje = `Error ${res.status}`;
    try {
      mensaje = (await res.json()).error ?? mensaje;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ErrorApi(mensaje, res.status);
  }

  return res.json() as Promise<T>;
}

export const urlBase = BASE;

export interface Usuario {
  usuarioId: string;
  nombre: string;
  rol: 'CONTADOR' | 'LIDER';
}

export interface Bodega {
  id: string;
  slug: string;
  nombre: string;
  tieneInventario: boolean;
  articulos: number;
}
