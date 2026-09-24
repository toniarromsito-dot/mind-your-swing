-- Fase 12C — Subscription multi-provider (RevenueCat + Stripe conviviendo).
-- NO se edita ninguna migración ya desplegada — esta es nueva y aditiva.
--
-- 1. User.hasUsedTrial: el trial pasa a ser una propiedad del USUARIO, no de
--    una fila de Subscription de un provider concreto. Se hace backfill
--    EXPLÍCITO desde Subscription.hasUsedTrial antes de borrar esa columna
--    — ningún usuario que ya hubiera usado su trial de Stripe lo pierde.
-- 2. Subscription pasa de "una fila por usuario" (unique en userId a secas)
--    a "una fila por (usuario, provider)" — permite Stripe + RevenueCat
--    simultáneos sin permitir nunca dos filas del mismo provider.
-- 3. Subscription.store (nullable, informativo): de qué tienda vino la
--    compra RevenueCat más reciente — nunca fuente de autorización.
-- 4. SubscriptionProvider gana el valor REVENUECAT.

-- AlterTable: User.hasUsedTrial
ALTER TABLE "User" ADD COLUMN "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false;

-- DataMigration: backfill explícito, no solo el DEFAULT false de arriba.
UPDATE "User"
SET "hasUsedTrial" = true
FROM "Subscription"
WHERE "Subscription"."userId" = "User"."id"
  AND "Subscription"."hasUsedTrial" = true;

-- DropIndex: el unique simple en userId ya no es correcto (impedía incluso
-- Stripe + RevenueCat para el mismo usuario, ver auditoría de esta fase).
DROP INDEX "Subscription_userId_key";

-- AlterTable: Subscription — quita hasUsedTrial (ya vive en User), añade store.
ALTER TABLE "Subscription" DROP COLUMN "hasUsedTrial";
ALTER TABLE "Subscription" ADD COLUMN "store" TEXT;

-- CreateIndex: la nueva garantía de cardinalidad real — como mucho una fila
-- por (userId, provider), nunca dos del mismo provider, sí una de cada.
CREATE UNIQUE INDEX "Subscription_userId_provider_key" ON "Subscription"("userId", "provider");

-- CreateIndex: ya no hay un unique simple en userId que sirva de índice
-- implícito para las queries que filtran solo por userId (p.ej. listar
-- todas las Subscription de un usuario para recomputeUserPlan()).
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- AlterEnum: nuevo provider. Sin DML que lo use en esta misma migración
-- (Postgres exige que un valor de enum recién añadido no se use en la
-- misma transacción que lo crea).
ALTER TYPE "SubscriptionProvider" ADD VALUE 'REVENUECAT';
