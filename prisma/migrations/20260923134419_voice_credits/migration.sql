-- Fase 11E — Voice Credits. Migración segura: conversationId es NULLABLE
-- (filas históricas de VoiceCallLog se quedan con NULL, sin backfill
-- ficticio) y las dos tablas nuevas nacen vacías — ningún dato existente se
-- borra, modifica ni recalcula.

-- AlterTable
ALTER TABLE "VoiceCallLog" ADD COLUMN     "conversationId" TEXT;

-- CreateTable
CREATE TABLE "VoiceCreditPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "consumedSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VoiceCreditPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicePurchasedBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "remainingSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VoicePurchasedBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCreditPeriod_userId_period_key" ON "VoiceCreditPeriod"("userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "VoicePurchasedBalance_userId_key" ON "VoicePurchasedBalance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCallLog_conversationId_key" ON "VoiceCallLog"("conversationId");

-- AddForeignKey
ALTER TABLE "VoiceCreditPeriod" ADD CONSTRAINT "VoiceCreditPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoicePurchasedBalance" ADD CONSTRAINT "VoicePurchasedBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
