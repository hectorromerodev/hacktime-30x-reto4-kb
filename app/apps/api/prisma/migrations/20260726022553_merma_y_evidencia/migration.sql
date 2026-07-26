-- CreateEnum
CREATE TYPE "TipoCaptura" AS ENUM ('CONTEO', 'MERMA');

-- AlterTable
ALTER TABLE "Captura" ADD COLUMN     "fotoUrl" TEXT,
ADD COLUMN     "incluidoEnConteo" BOOLEAN,
ADD COLUMN     "motivoMerma" TEXT,
ADD COLUMN     "tipo" "TipoCaptura" NOT NULL DEFAULT 'CONTEO';
