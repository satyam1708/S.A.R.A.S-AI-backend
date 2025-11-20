-- 1. Restore HNSW Vector Index (Prisma Schema doesn't handle this syntax natively yet)
CREATE INDEX IF NOT EXISTS "ContentBlock_vector_idx" ON "ContentBlock" USING hnsw ("vector" vector_cosine_ops);

-- 2. Standard Indexes (Prisma usually generates these automatically now that they are in schema, but let's ensure they exist)
CREATE INDEX IF NOT EXISTS "Chapter_subjectId_idx" ON "Chapter"("subjectId");
CREATE INDEX IF NOT EXISTS "Topic_subjectId_idx" ON "Topic"("subjectId");
CREATE INDEX IF NOT EXISTS "Topic_chapterId_idx" ON "Topic"("chapterId");
CREATE INDEX IF NOT EXISTS "ContentBlock_topicId_idx" ON "ContentBlock"("topicId");
CREATE INDEX IF NOT EXISTS "QuestionBank_topicId_idx" ON "QuestionBank"("topicId");
CREATE INDEX IF NOT EXISTS "MockTest_courseId_idx" ON "MockTest"("courseId");
CREATE INDEX IF NOT EXISTS "MockTestAttempt_userId_idx" ON "MockTestAttempt"("userId");
CREATE INDEX IF NOT EXISTS "MockTestAttempt_mockTestId_idx" ON "MockTestAttempt"("mockTestId");
CREATE INDEX IF NOT EXISTS "MockTestAnswer_attemptId_idx" ON "MockTestAnswer"("attemptId");
CREATE INDEX IF NOT EXISTS "MockTestAnswer_questionId_idx" ON "MockTestAnswer"("questionId");
CREATE INDEX IF NOT EXISTS "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "ChatSession_userId_idx" ON "ChatSession"("userId");
CREATE INDEX IF NOT EXISTS "CourseSubject_courseId_idx" ON "CourseSubject"("courseId");
CREATE INDEX IF NOT EXISTS "CourseSubject_subjectId_idx" ON "CourseSubject"("subjectId");
CREATE INDEX IF NOT EXISTS "MockTestQuestion_questionId_idx" ON "MockTestQuestion"("questionId");