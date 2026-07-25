-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('CONTADOR', 'LIDER');

-- CreateEnum
CREATE TYPE "EstadoConteo" AS ENUM ('ABIERTO', 'CERRADO', 'EXPORTADO');

-- CreateEnum
CREATE TYPE "Metodo" AS ENUM ('VOZ', 'TECLADO', 'CAMARA', 'BUSQUEDA');

-- CreateEnum
CREATE TYPE "EstadoCaptura" AS ENUM ('ACTIVA', 'REEMPLAZADA', 'ANULADA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CONTADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bodega" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreNormalizado" TEXT NOT NULL,
    "tieneInventario" BOOLEAN NOT NULL DEFAULT false,
    "hojaOrigen" TEXT,

    CONSTRAINT "Bodega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Articulo" (
    "id" TEXT NOT NULL,
    "nrArticulo" TEXT,
    "nombre" TEXT NOT NULL,
    "nombreNormalizado" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "familia" TEXT NOT NULL DEFAULT 'OTROS',

    CONSTRAINT "Articulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "bodegaId" TEXT NOT NULL,
    "articuloId" TEXT NOT NULL,
    "sd" DECIMAL(14,3) NOT NULL,
    "exp10" INTEGER,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("bodegaId","articuloId")
);

-- CreateTable
CREATE TABLE "Conteo" (
    "id" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "fechaCorte" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoConteo" NOT NULL DEFAULT 'ABIERTO',
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "Conteo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConteoParticipante" (
    "conteoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CONTADOR',
    "unidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConteoParticipante_pkey" PRIMARY KEY ("conteoId","usuarioId")
);

-- CreateTable
CREATE TABLE "Captura" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "conteoId" TEXT NOT NULL,
    "articuloId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "unidad" TEXT NOT NULL,
    "unidadDicha" TEXT,
    "metodo" "Metodo" NOT NULL,
    "textoCrudo" TEXT,
    "scoreMatch" DOUBLE PRECISION,
    "anomalias" JSONB NOT NULL DEFAULT '[]',
    "motivoConfirmacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "deviceId" TEXT,
    "capturadoEn" TIMESTAMP(3) NOT NULL,
    "recibidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoCaptura" NOT NULL DEFAULT 'ACTIVA',
    "enConflicto" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "reemplazaA" TEXT,

    CONSTRAINT "Captura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoArticulo" (
    "codigo" TEXT NOT NULL,
    "articuloId" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoArticulo_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "ArticuloFactor" (
    "id" TEXT NOT NULL,
    "articuloId" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "nombreEmpaque" TEXT NOT NULL,
    "factor" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "ArticuloFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bodega_slug_key" ON "Bodega"("slug");

-- CreateIndex
CREATE INDEX "Bodega_nombreNormalizado_idx" ON "Bodega"("nombreNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "Articulo_nombreNormalizado_key" ON "Articulo"("nombreNormalizado");

-- CreateIndex
CREATE INDEX "Articulo_familia_idx" ON "Articulo"("familia");

-- CreateIndex
CREATE INDEX "Stock_bodegaId_orden_idx" ON "Stock"("bodegaId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Conteo_bodegaId_periodo_key" ON "Conteo"("bodegaId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "Captura_clientId_key" ON "Captura"("clientId");

-- CreateIndex
CREATE INDEX "Captura_conteoId_articuloId_idx" ON "Captura"("conteoId", "articuloId");

-- CreateIndex
CREATE INDEX "Captura_conteoId_estado_idx" ON "Captura"("conteoId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "ArticuloFactor_articuloId_bodegaId_nombreEmpaque_key" ON "ArticuloFactor"("articuloId", "bodegaId", "nombreEmpaque");

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "Bodega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conteo" ADD CONSTRAINT "Conteo_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "Bodega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conteo" ADD CONSTRAINT "Conteo_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConteoParticipante" ADD CONSTRAINT "ConteoParticipante_conteoId_fkey" FOREIGN KEY ("conteoId") REFERENCES "Conteo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConteoParticipante" ADD CONSTRAINT "ConteoParticipante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Captura" ADD CONSTRAINT "Captura_conteoId_fkey" FOREIGN KEY ("conteoId") REFERENCES "Conteo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Captura" ADD CONSTRAINT "Captura_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Captura" ADD CONSTRAINT "Captura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoArticulo" ADD CONSTRAINT "CodigoArticulo_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticuloFactor" ADD CONSTRAINT "ArticuloFactor_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
