// src/modules/admin/admin.service.js
import prisma from "../../lib/prisma.js";
import {
  generateQuizFromContent,
  chunkContentForLearning,
  generateFlashcardsFromContent,
  getEmbedding,
} from "../../services/aiService.js";

// --- Subject Management ---
export const createSubject = (name) =>
  prisma.subject.create({ data: { name } });
export const getAllSubjects = () =>
  prisma.subject.findMany({
    include: { _count: { select: { topics: true } } },
    orderBy: { name: "asc" },
  });
export const updateSubject = (id, name) =>
  prisma.subject.update({ where: { id }, data: { name } });
export const deleteSubject = (id) => prisma.subject.delete({ where: { id } });

// --- Chapter Management (Hierarchical Structure) ---
export const createChapter = (name, subjectId) =>
  prisma.chapter.create({ data: { name, subjectId } });
export const getChapters = (subjectId) =>
  prisma.chapter.findMany({
    where: { subjectId },
    include: { _count: { select: { topics: true } } },
    orderBy: { name: "asc" },
  });
export const updateChapter = (id, name) =>
  prisma.chapter.update({ where: { id }, data: { name } });
export const deleteChapter = (id) => prisma.chapter.delete({ where: { id } });

// --- Topic Management ---
export const createTopic = (name, subjectId, chapterId = null) => {
  return prisma.topic.create({
    data: {
      name,
      subjectId,
      chapterId,
    },
  });
};
export const getTopics = (subjectId) => {
  return prisma.topic.findMany({
    where: { subjectId },
    include: {
      _count: { select: { content: true } },
      chapter: true,
    },
    orderBy: [{ chapter: { name: "asc" } }, { name: "asc" }],
  });
};
export const updateTopic = (id, name) =>
  prisma.topic.update({ where: { id }, data: { name } });
export const deleteTopic = (id) => prisma.topic.delete({ where: { id } });

// --- Content & AI Management ---
export const addContent = async (topicId, content) => {
  // 1. Generate Vector
  const embedding = await getEmbedding(content);

  // 2. Save Block
  const block = await prisma.contentBlock.create({
    data: { topicId, content },
  });

  // 3. Save Vector (Raw SQL required for pgvector)
  const vectorString = `[${embedding.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE "ContentBlock" SET vector = $1::vector WHERE id = $2`,
    vectorString,
    block.id
  );
  return block;
};

export const updateContent = async (blockId, content) => {
  const embedding = await getEmbedding(content);

  const block = await prisma.contentBlock.update({
    where: { id: blockId },
    data: { content },
  });

  const vectorString = `[${embedding.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE "ContentBlock" SET vector = $1::vector WHERE id = $2`,
    vectorString,
    block.id
  );
  return block;
};

export const getContent = (topicId) =>
  prisma.contentBlock.findMany({
    where: { topicId },
    orderBy: { id: "asc" },
  });

export const deleteContent = (blockId) =>
  prisma.contentBlock.delete({ where: { id: blockId } });

// --- Quiz Generation Logic ---
export const generateQuiz = async (topicId) => {
  const contentBlocks = await prisma.contentBlock.findMany({
    where: { topicId },
  });
  if (contentBlocks.length === 0)
    throw new Error("No content to generate quiz from.");

  const context = contentBlocks.map((block) => block.content).join("\n\n");
  const questions = await generateQuizFromContent(context);

  const newQuiz = await prisma.quiz.create({
    data: {
      topicId: topicId,
      questions: {
        create: questions.map((q) => ({
          questionText: q.questionText,
          options: q.options,
          correctAnswerIndex: q.correctAnswerIndex,
        })),
      },
    },
    include: { questions: true },
  });

  // Async Flashcard generation (doesn't block response)
  generateFlashcardsFromContent(context)
    .then(async (flashcards) => {
      if (flashcards && flashcards.length > 0) {
        const flashcardData = flashcards.map((fc) => ({
          topicId: topicId,
          question: fc.question,
          answer: fc.answer,
        }));
        await prisma.flashcard.createMany({
          data: flashcardData,
          skipDuplicates: true,
        });
      }
    })
    .catch((err) => console.error("Flashcard Gen Error:", err));

  return newQuiz;
};

export const getQuizzesForTopic = (topicId) =>
  prisma.quiz.findMany({
    where: { topicId },
    include: { questions: { orderBy: { id: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

export const deleteQuiz = (quizId) =>
  prisma.quiz.delete({ where: { id: quizId } });

export const processBookUpload = async (topicId, fullText) => {
  if (!fullText.trim()) throw new Error("File is empty.");
  const contentChunks = await chunkContentForLearning(fullText);

  if (!contentChunks || contentChunks.length === 0) return 0;

  let createdCount = 0;
  for (const chunk of contentChunks) {
    try {
      await addContent(topicId, chunk);
      createdCount++;
    } catch (err) {
      console.error(`Failed to create block:`, err);
    }
  }
  return createdCount;
};
