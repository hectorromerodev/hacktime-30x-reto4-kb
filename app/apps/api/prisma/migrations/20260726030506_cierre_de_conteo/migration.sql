-- Cierre de conteo y posibilidad de abrir otro en el mismo periodo.

ALTER TABLE "Conteo" ADD COLUMN "secuencia" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Conteo" ADD COLUMN "cerradoPorId" TEXT;
ALTER TABLE "Conteo" ADD COLUMN "notaCierre" TEXT;

-- La llave unica pasa de (bodega, periodo) a (bodega, periodo, secuencia):
-- sin eso no se puede cerrar un conteo y empezar otro sin esperar al mes
-- siguiente. Los conteos existentes ya tienen secuencia = 1, asi que no hay
-- duplicados posibles.
DROP INDEX IF EXISTS "Conteo_bodegaId_periodo_key";
CREATE UNIQUE INDEX "Conteo_bodegaId_periodo_secuencia_key"
  ON "Conteo"("bodegaId", "periodo", "secuencia");

CREATE INDEX "Conteo_bodegaId_estado_idx" ON "Conteo"("bodegaId", "estado");

ALTER TABLE "Conteo" ADD CONSTRAINT "Conteo_cerradoPorId_fkey"
  FOREIGN KEY ("cerradoPorId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
