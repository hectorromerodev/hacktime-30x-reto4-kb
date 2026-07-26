-- CreateTable
CREATE TABLE "Evidencia" (
    "clientId" TEXT NOT NULL,
    "tipoContenido" TEXT NOT NULL,
    "datos" BYTEA NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidencia_pkey" PRIMARY KEY ("clientId")
);
