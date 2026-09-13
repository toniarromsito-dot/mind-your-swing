-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "club" TEXT NOT NULL,
    "distanceMeters" INTEGER,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shot_scoreId_idx" ON "Shot"("scoreId");

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "Score"("id") ON DELETE CASCADE ON UPDATE CASCADE;
