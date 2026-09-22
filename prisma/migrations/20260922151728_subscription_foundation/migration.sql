/*
  Warnings:

  - You are about to drop the column `currentPeriodEnd` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `stripeCustomerId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSubscriptionId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSubscriptionStatus` on the `User` table. All the data in the column will be lost.

  Los cuatro campos se copian a la nueva tabla "Subscription" (ver bloque de
  migración de datos más abajo) antes de eliminarse — ningún usuario con
  suscripción de Stripe existente pierde su estado.
*/
-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'UNPAID');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL DEFAULT 'STRIPE',
    "providerCustomerId" TEXT NOT NULL,
    "providerSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "billingInterval" "BillingInterval",
    "priceId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialEnd" TIMESTAMP(3),
    "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB NOT NULL,
    "subscriptionId" TEXT,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerCustomerId_key" ON "Subscription"("providerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEvent_providerEventId_key" ON "SubscriptionEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_subscriptionId_idx" ON "SubscriptionEvent"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: copia el estado de Stripe que ya vivía en "User" a la nueva
-- "Subscription" antes de borrar esas columnas. Solo se migran usuarios que
-- ya tenían un stripeCustomerId (los demás nunca han tocado Stripe, no
-- necesitan fila). El status en texto libre de Stripe se normaliza al enum
-- nuevo con el mismo mapeo que usa normalizeStripeStatus() en el código
-- (src/lib/stripe.ts) — cualquier valor no reconocido cae a INCOMPLETE
-- (política segura: no reconocer no concede Pro por defecto).
--
-- hasUsedTrial se marca true para cualquier usuario que ya tuviera un
-- stripeSubscriptionId real (ha pasado por Stripe checkout al menos una
-- vez): decisión deliberada para que la migración en sí no reabra el trial
-- de 3 días a nadie que ya tuviera una suscripción, activa o no.
INSERT INTO "Subscription" (
    "id", "userId", "provider", "providerCustomerId", "providerSubscriptionId",
    "status", "currentPeriodEnd", "hasUsedTrial", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    "id",
    'STRIPE',
    "stripeCustomerId",
    "stripeSubscriptionId",
    CASE lower(COALESCE("stripeSubscriptionStatus", ''))
        WHEN 'active' THEN 'ACTIVE'
        WHEN 'trialing' THEN 'TRIALING'
        WHEN 'past_due' THEN 'PAST_DUE'
        WHEN 'canceled' THEN 'CANCELED'
        WHEN 'incomplete' THEN 'INCOMPLETE'
        WHEN 'incomplete_expired' THEN 'INCOMPLETE_EXPIRED'
        WHEN 'unpaid' THEN 'UNPAID'
        ELSE 'INCOMPLETE'
    END::"SubscriptionStatus",
    "currentPeriodEnd",
    ("stripeSubscriptionId" IS NOT NULL),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
WHERE "stripeCustomerId" IS NOT NULL;

-- DropIndex
DROP INDEX "User_stripeCustomerId_key";

-- DropIndex
DROP INDEX "User_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "currentPeriodEnd",
DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId",
DROP COLUMN "stripeSubscriptionStatus";
