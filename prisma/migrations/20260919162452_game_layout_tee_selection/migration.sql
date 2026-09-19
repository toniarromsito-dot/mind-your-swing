-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "courseLayoutId" TEXT,
ADD COLUMN     "courseTeeId" TEXT,
ADD COLUMN     "layoutName" TEXT,
ADD COLUMN     "teeCategory" TEXT,
ADD COLUMN     "teeCourseRating" DOUBLE PRECISION,
ADD COLUMN     "teeName" TEXT,
ADD COLUMN     "teeSlope" INTEGER;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_courseLayoutId_fkey" FOREIGN KEY ("courseLayoutId") REFERENCES "GolfCourseLayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_courseTeeId_fkey" FOREIGN KEY ("courseTeeId") REFERENCES "GolfCourseTee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

