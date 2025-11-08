/*
  Warnings:

  - A unique constraint covering the columns `[userId,topicId]` on the table `ChatSession` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ChatSession_topicId_key";

-- DropIndex
DROP INDEX "ChatSession_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_userId_topicId_key" ON "ChatSession"("userId", "topicId");
