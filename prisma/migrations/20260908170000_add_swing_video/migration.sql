-- CreateEnum
CREATE TYPE "SwingVideoStatus" AS ENUM ('PENDING', 'REVIEWED');

-- CreateTable
CREATE TABLE "SwingVideo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "note" TEXT,
    "status" "SwingVideoStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "SwingVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SwingVideo_userId_createdAt_idx" ON "SwingVideo"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SwingVideo_status_createdAt_idx" ON "SwingVideo"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SwingVideo" ADD CONSTRAINT "SwingVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

