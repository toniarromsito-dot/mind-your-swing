-- AlterTable
ALTER TABLE "GolfCourse" ADD COLUMN     "country" TEXT,
ADD COLUMN     "island" TEXT,
ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "GolfCourseLayout" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "holeCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GolfCourseLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GolfCourseTee" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parTotal" INTEGER,
    "distanceTotal" INTEGER,
    "courseRating" DOUBLE PRECISION,
    "slope" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GolfCourseTee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GolfCourseTeeHole" (
    "id" TEXT NOT NULL,
    "teeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "par" INTEGER,
    "index" INTEGER,
    "distance" INTEGER,

    CONSTRAINT "GolfCourseTeeHole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GolfCourseLayout_courseId_name_key" ON "GolfCourseLayout"("courseId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GolfCourseTee_layoutId_name_key" ON "GolfCourseTee"("layoutId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GolfCourseTeeHole_teeId_number_key" ON "GolfCourseTeeHole"("teeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "GolfCourse_slug_key" ON "GolfCourse"("slug");

-- AddForeignKey
ALTER TABLE "GolfCourseLayout" ADD CONSTRAINT "GolfCourseLayout_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GolfCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfCourseTee" ADD CONSTRAINT "GolfCourseTee_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "GolfCourseLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfCourseTeeHole" ADD CONSTRAINT "GolfCourseTeeHole_teeId_fkey" FOREIGN KEY ("teeId") REFERENCES "GolfCourseTee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

