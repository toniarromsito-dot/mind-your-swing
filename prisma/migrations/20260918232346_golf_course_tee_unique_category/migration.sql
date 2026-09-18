-- DropIndex
DROP INDEX "GolfCourseTee_layoutId_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "GolfCourseTee_layoutId_name_category_key" ON "GolfCourseTee"("layoutId", "name", "category");

