-- DataMigration: the golf-domain model changed shape too much for a
-- 1:1 migration (single-player Round/Hole -> multiplayer Game/GamePlayer/
-- Score didn't exist before). Pre-launch, no real user base depends on
-- this history, so we clear it rather than attempt a lossy best-effort
-- mapping. Auth tables (User/Account/Session) are untouched.
TRUNCATE TABLE "MoodEntry", "Message", "Hole", "Round" RESTART IDENTITY CASCADE;

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('SOLO', 'STROKE_PLAY', 'MATCH_PLAY', 'DUEL', 'FRIENDLY_CHALLENGE', 'EVERYONE_VS_EVERYONE', 'POINTS', 'TWO_VS_TWO', 'BEST_BALL', 'SCRAMBLE', 'TEAM_DUEL');

-- CreateEnum
CREATE TYPE "Team" AS ENUM ('A', 'B');

-- AlterEnum: old values (CERCANO/FORMAL) don't map cleanly onto the new
-- personalities, so the column is dropped and recreated with the new
-- enum rather than cast — everyone just resets to the FRIEND default.
ALTER TABLE "User" DROP COLUMN "coachTone";
DROP TYPE "CoachTone";
CREATE TYPE "CoachTone" AS ENUM ('CALM', 'MOTIVATOR', 'COACH', 'FRIEND');
ALTER TABLE "User" ADD COLUMN "coachTone" "CoachTone" NOT NULL DEFAULT 'FRIEND';

-- DropForeignKey
ALTER TABLE "Hole" DROP CONSTRAINT "Hole_roundId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_roundId_fkey";

-- DropForeignKey
ALTER TABLE "MoodEntry" DROP CONSTRAINT "MoodEntry_roundId_fkey";

-- DropForeignKey
ALTER TABLE "Round" DROP CONSTRAINT "Round_userId_fkey";

-- DropIndex
DROP INDEX "Hole_roundId_number_key";

-- DropIndex
DROP INDEX "Message_roundId_createdAt_idx";

-- DropIndex
DROP INDEX "MoodEntry_roundId_createdAt_idx";

-- AlterTable
ALTER TABLE "Hole" DROP COLUMN "putts",
DROP COLUMN "roundId",
DROP COLUMN "strokes",
ADD COLUMN     "gameId" TEXT NOT NULL,
ADD COLUMN     "index" INTEGER;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "roundId",
ADD COLUMN     "gameId" TEXT;

-- AlterTable
ALTER TABLE "MoodEntry" DROP COLUMN "roundId",
ADD COLUMN     "gameId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "coachTone" SET DEFAULT 'FRIEND';

-- DropTable
DROP TABLE "Round";

-- DropEnum
DROP TYPE "RoundStatus";

-- CreateTable
CREATE TABLE "GolfCourse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GolfCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GolfCourseHole" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "par" INTEGER NOT NULL,
    "index" INTEGER,
    "distance" INTEGER,

    CONSTRAINT "GolfCourseHole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "course" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL,
    "playerCount" INTEGER NOT NULL DEFAULT 1,
    "date" TIMESTAMP(3) NOT NULL,
    "totalHoles" INTEGER NOT NULL DEFAULT 18,
    "goal" TEXT,
    "status" "GameStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "insight" TEXT,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlayer" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "team" "Team",
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "holeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "strokes" INTEGER,
    "putts" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeWin" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "challengeKey" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "holeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeWin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GolfCourseHole_courseId_number_key" ON "GolfCourseHole"("courseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Game_inviteCode_key" ON "Game"("inviteCode");

-- CreateIndex
CREATE INDEX "Game_date_idx" ON "Game"("date");

-- CreateIndex
CREATE INDEX "GamePlayer_gameId_idx" ON "GamePlayer"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_userId_key" ON "GamePlayer"("gameId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Score_holeId_playerId_key" ON "Score"("holeId", "playerId");

-- CreateIndex
CREATE INDEX "ChallengeWin_gameId_idx" ON "ChallengeWin"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Hole_gameId_number_key" ON "Hole"("gameId", "number");

-- CreateIndex
CREATE INDEX "Message_gameId_createdAt_idx" ON "Message"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_userId_createdAt_idx" ON "Message"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MoodEntry_gameId_createdAt_idx" ON "MoodEntry"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "MoodEntry_userId_createdAt_idx" ON "MoodEntry"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "GolfCourseHole" ADD CONSTRAINT "GolfCourseHole_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GolfCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GolfCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hole" ADD CONSTRAINT "Hole_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_holeId_fkey" FOREIGN KEY ("holeId") REFERENCES "Hole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeWin" ADD CONSTRAINT "ChallengeWin_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodEntry" ADD CONSTRAINT "MoodEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

