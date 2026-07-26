/**
 * Preparación de la evidencia fotográfica.
 *
 * La foto de una tablet moderna pesa entre 3 y 8 MB. Subir eso desde una
 * bodega con cobertura mala es garantía de que la sincronización nunca
 * termine, así que se reduce en el propio dispositivo antes de guardarla.
 *
 * 1280 px y calidad 0,6 dejan la imagen entre 80 y 200 KB: suficiente para
 * ver una caja rota o una fecha de vencimiento, que es para lo que sirve.
 */

const LADO_MAXIMO = 1280;
const CALIDAD = 0.6;

export interface FotoPreparada {
  /** base64 sin el prefijo `data:`, listo para enviar. */
  datos: string;
  tipoContenido: string;
  /** Para previsualizarla sin volver a leer el archivo. */
  vistaPrevia: string;
  bytes: number;
}

export async function prepararFoto(archivo: File): Promise<FotoPreparada> {
  const bitmap = await crearBitmap(archivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, ancho, alto);

  const vistaPrevia = lienzo.toDataURL('image/jpeg', CALIDAD);
  const datos = vistaPrevia.slice(vistaPrevia.indexOf(',') + 1);

  return {
    datos,
    tipoContenido: 'image/jpeg',
    vistaPrevia,
    // base64 abulta ~4/3 respecto a los bytes reales.
    bytes: Math.round((datos.length * 3) / 4),
  };
}

/**
 * `createImageBitmap` respeta la orientación EXIF y evita fotos giradas; se
 * deja una alternativa por si el navegador no la trae.
 */
async function crearBitmap(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' } as never);
    } catch {
      /* sigue por la alternativa */
    }
  }
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
}

/** Motivos de baja. Lista cerrada para poder agrupar por causa en el reporte. */
export const MOTIVOS_MERMA = [
  'Vencido',
  'Dañado o roto',
  'Derrame',
  'Contaminado',
  'Descompuesto',
  'Otro',
] as const;
