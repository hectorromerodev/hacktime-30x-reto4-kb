import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** Prisma devuelve Decimal; el JSON de la API viaja como number. */
export function aNumero(valor: unknown): number {
  if (valor == null) return 0;
  if (typeof valor === 'number') return valor;
  return Number(valor.toString());
}
