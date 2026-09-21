-- CreateEnum
CREATE TYPE "TournamentSource" AS ENUM ('MANUAL', 'IMPORTED', 'CLUB_SYNC', 'EXTERNAL_PROVIDER');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentParticipantStatus" AS ENUM ('REGISTERED', 'CANCELLED', 'NO_SHOW', 'REMOVED');

-- CreateEnum
CREATE TYPE "IdentityConfidence" AS ENUM ('UNVERIFIED', 'PLAYER_CONFIRMED', 'LICENSE_VERIFIED');

-- CreateEnum
CREATE TYPE "TournamentResultStatus" AS ENUM ('PROVISIONAL', 'FINAL', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "LicenseVerificationStatus" AS ENUM ('UNVERIFIED', 'SELF_DECLARED', 'VERIFIED');

-- DropForeignKey
ALTER TABLE "TournamentRegistration" DROP CONSTRAINT "TournamentRegistration_tournamentId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentRegistration" DROP CONSTRAINT "TournamentRegistration_userId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentResult" DROP CONSTRAINT "TournamentResult_playerId_fkey";

-- DropIndex
DROP INDEX "TournamentResult_tournamentId_playerId_key";

-- AlterTable
ALTER TABLE "HandicapEntry" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalProvider" TEXT,
ADD COLUMN     "hasCategories" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organizerId" TEXT,
ADD COLUMN     "source" "TournamentSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "TournamentResult" DROP COLUMN "playerId",
ADD COLUMN     "categorySnapshot" TEXT,
ADD COLUMN     "correctedAt" TIMESTAMP(3),
ADD COLUMN     "correctionReason" TEXT,
ADD COLUMN     "externalResultId" TEXT,
ADD COLUMN     "gameId" TEXT,
ADD COLUMN     "netScore" INTEGER,
ADD COLUMN     "participantId" TEXT NOT NULL,
ADD COLUMN     "status" "TournamentResultStatus" NOT NULL DEFAULT 'PROVISIONAL';

-- DropTable
DROP TABLE "TournamentRegistration";

-- CreateTable
CREATE TABLE "TournamentParticipant" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerProfileId" TEXT NOT NULL,
    "status" "TournamentParticipantStatus" NOT NULL DEFAULT 'REGISTERED',
    "identityConfidence" "IdentityConfidence" NOT NULL DEFAULT 'UNVERIFIED',
    "category" TEXT,
    "gameId" TEXT,
    "externalParticipantId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FederationIdentity" (
    "id" TEXT NOT NULL,
    "playerProfileId" TEXT NOT NULL,
    "federationProvider" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "verificationStatus" "LicenseVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "verificationSource" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederationIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipant_gameId_key" ON "TournamentParticipant"("gameId");

-- CreateIndex
CREATE INDEX "TournamentParticipant_tournamentId_status_idx" ON "TournamentParticipant"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipant_tournamentId_playerProfileId_key" ON "TournamentParticipant"("tournamentId", "playerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipant_tournamentId_externalParticipantId_key" ON "TournamentParticipant"("tournamentId", "externalParticipantId");

-- CreateIndex
CREATE INDEX "FederationIdentity_licenseNumber_idx" ON "FederationIdentity"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FederationIdentity_playerProfileId_federationProvider_key" ON "FederationIdentity"("playerProfileId", "federationProvider");

-- CreateIndex
CREATE UNIQUE INDEX "FederationIdentity_federationProvider_licenseNumber_key" ON "FederationIdentity"("federationProvider", "licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_externalProvider_externalId_key" ON "Tournament"("externalProvider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentResult_gameId_key" ON "TournamentResult"("gameId");

-- CreateIndex
CREATE INDEX "TournamentResult_tournamentId_status_idx" ON "TournamentResult"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentResult_tournamentId_participantId_key" ON "TournamentResult"("tournamentId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentResult_tournamentId_externalResultId_key" ON "TournamentResult"("tournamentId", "externalResultId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_matchedByUserId_fkey" FOREIGN KEY ("matchedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentResult" ADD CONSTRAINT "TournamentResult_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TournamentParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationIdentity" ADD CONSTRAINT "FederationIdentity_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

