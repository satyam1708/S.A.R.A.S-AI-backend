-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "ContentBlock" ADD COLUMN     "vector" vector(1536);
