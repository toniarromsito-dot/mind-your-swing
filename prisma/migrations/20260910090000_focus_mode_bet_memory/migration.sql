-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "bet" TEXT,
ADD COLUMN     "started" BOOLEAN NOT NULL DEFAULT false;

-- DataMigration: partidas creadas antes de que existiera el "lobby"
-- arrancaron directamente en juego — marcarlas como iniciadas para que no
-- aparezcan de repente en un lobby que nunca pasaron. Las partidas nuevas
-- sí usan el default (false) hasta pulsar "Empezar partida".
UPDATE "Game" SET "started" = true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mindMemory" TEXT;

