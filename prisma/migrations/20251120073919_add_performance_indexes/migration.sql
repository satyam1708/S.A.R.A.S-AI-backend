-- ============================================================
-- 1. VECTOR SEARCH ACCELERATION (The "AI Speedup")
-- ============================================================
-- Adds HNSW index. fast precise vector search.
-- Speedup: ~100x for related content retrieval.
CREATE INDEX IF NOT EXISTS "ContentBlock_vector_idx" 
ON "ContentBlock" USING hnsw ("vector" vector_cosine_ops);

-- ============================================================
-- 2. CRITICAL FOREIGN KEY INDEXES (The "Relational Speedup")
-- ============================================================
-- PostgreSQL does not index FKs by default. We must do it manually.

-- A. Core Content Hierarchy (Subject -> Chapter -> Topic -> Content)
CREATE INDEX IF NOT EXISTS "Chapter_subjectId_idx" ON "Chapter"("subjectId");
CREATE INDEX IF NOT EXISTS "Topic_subjectId_idx"   ON "Topic"("subjectId");
CREATE INDEX IF NOT EXISTS "Topic_chapterId_idx"   ON "Topic"("chapterId");
CREATE INDEX IF NOT EXISTS "ContentBlock_topicId_idx" ON "ContentBlock"("topicId");

-- B. Question Bank & Exams (Heavily queried during test generation)
CREATE INDEX IF NOT EXISTS "QuestionBank_topicId_idx" ON "QuestionBank"("topicId");
CREATE INDEX IF NOT EXISTS "MockTest_courseId_idx"    ON "MockTest"("courseId");

-- C. Exam Attempts & Answers (CRITICAL for Analytics Dashboards)
-- Prevents "waterfall" slowness when loading student history.
CREATE INDEX IF NOT EXISTS "MockTestAttempt_userId_idx"     ON "MockTestAttempt"("userId");
CREATE INDEX IF NOT EXISTS "MockTestAttempt_mockTestId_idx" ON "MockTestAttempt"("mockTestId");

-- D. Granular Answers (This table grows the fastest, NEEDS indexing)
CREATE INDEX IF NOT EXISTS "MockTestAnswer_attemptId_idx"  ON "MockTestAnswer"("attemptId");
CREATE INDEX IF NOT EXISTS "MockTestAnswer_questionId_idx" ON "MockTestAnswer"("questionId");

-- E. Chat & Learning History
CREATE INDEX IF NOT EXISTS "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "ChatSession_userId_idx"    ON "ChatSession"("userId");

-- F. Course Configuration
CREATE INDEX IF NOT EXISTS "CourseSubject_courseId_idx"  ON "CourseSubject"("courseId");
CREATE INDEX IF NOT EXISTS "CourseSubject_subjectId_idx" ON "CourseSubject"("subjectId");