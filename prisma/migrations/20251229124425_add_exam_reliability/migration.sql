/*
  Warnings:

  - A unique constraint covering the columns `[attemptId,questionId]` on the table `MockTestAnswer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MockTestAnswer" ALTER COLUMN "isCorrect" SET DEFAULT false,
ALTER COLUMN "timeTaken" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "MockTestAttempt" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "percentile" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
ADD COLUMN     "topicAnalysis" JSONB,
ALTER COLUMN "score" SET DEFAULT 0,
ALTER COLUMN "timeTaken" SET DEFAULT 0,
ALTER COLUMN "correctCount" SET DEFAULT 0,
ALTER COLUMN "wrongCount" SET DEFAULT 0,
ALTER COLUMN "skippedCount" SET DEFAULT 0,
ALTER COLUMN "submittedAt" DROP NOT NULL,
ALTER COLUMN "submittedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "MockTestAnswer_attemptId_questionId_key" ON "MockTestAnswer"("attemptId", "questionId");
