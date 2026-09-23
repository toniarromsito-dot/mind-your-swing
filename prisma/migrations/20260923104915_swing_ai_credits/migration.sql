-- AlterTable: analysisRequestId se añade primero NULLABLE porque la tabla
-- puede tener filas existentes — se rellenan con su propio id (ya único)
-- como valor de respaldo antes de exigir NOT NULL + UNIQUE. Ninguna fila
-- histórica pierde datos ni cambia de significado: simplemente nunca podrá
-- coincidir por accidente con el id de una request nueva (cuids vs los ids
-- que el cliente genere para analysisRequestId son space distintos en la
-- práctica, y aunque coincidieran, esas filas ya están completadas y no se
-- vuelven a tocar).
ALTER TABLE "SwingVideo" ADD COLUMN "analysisRequestId" TEXT;

UPDATE "SwingVideo" SET "analysisRequestId" = "id" WHERE "analysisRequestId" IS NULL;

ALTER TABLE "SwingVideo" ALTER COLUMN "analysisRequestId" SET NOT NULL;

-- CreateTable
CREATE TABLE "SwingAiCreditPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "consumed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SwingAiCreditPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SwingAiCreditPeriod_userId_period_key" ON "SwingAiCreditPeriod"("userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "SwingVideo_analysisRequestId_key" ON "SwingVideo"("analysisRequestId");

-- AddForeignKey
ALTER TABLE "SwingAiCreditPeriod" ADD CONSTRAINT "SwingAiCreditPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
