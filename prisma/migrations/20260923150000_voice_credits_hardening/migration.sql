-- Fase 11E — Security hardening (sección 46/49). NO se edita la migración ya
-- desplegada (20260923134419_voice_credits): esta es nueva y aditiva.
--
-- 1. excessSeconds en VoiceCallLog: hace observable cuánto de una llamada
--    superó el saldo disponible (ver tryConsumeVoiceCredit). DEFAULT 0 y
--    backfill implícito a 0 para filas históricas — ninguna fila existente
--    cambia de significado.
-- 2. CHECK constraints a nivel de Postgres para los dos saldos: la garantía
--    de "nunca negativo" ya la cumple la lógica de aplicación dentro de la
--    transacción (Math.max/Math.min), pero sección 46 pide explícitamente
--    no depender solo de eso — un CHECK es la última línea de defensa si
--    algún camino futuro (migración manual, script, bug) intentara dejar
--    un valor negativo.

-- AlterTable
ALTER TABLE "VoiceCallLog" ADD COLUMN "excessSeconds" INTEGER NOT NULL DEFAULT 0;

-- CHECK constraints (fail-closed a nivel de DB, no solo de aplicación)
ALTER TABLE "VoiceCallLog" ADD CONSTRAINT "VoiceCallLog_excessSeconds_nonnegative" CHECK ("excessSeconds" >= 0);
ALTER TABLE "VoiceCreditPeriod" ADD CONSTRAINT "VoiceCreditPeriod_consumedSeconds_nonnegative" CHECK ("consumedSeconds" >= 0);
ALTER TABLE "VoicePurchasedBalance" ADD CONSTRAINT "VoicePurchasedBalance_remainingSeconds_nonnegative" CHECK ("remainingSeconds" >= 0);
