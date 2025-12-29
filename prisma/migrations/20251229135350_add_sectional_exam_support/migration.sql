-- AlterTable
ALTER TABLE "CourseSubject" ADD COLUMN     "difficultyConfig" JSONB;

-- AlterTable
ALTER TABLE "MockTest" ADD COLUMN     "examType" TEXT NOT NULL DEFAULT 'FULL_MOCK',
ADD COLUMN     "subjectId" INTEGER,
ALTER COLUMN "totalMarks" SET DATA TYPE DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "MockTest" ADD CONSTRAINT "MockTest_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
