// src/modules/admin/admin.service.js
import prisma from '../../lib/prisma.js';
import { generateQuizFromContent, chunkContentForLearning } from '../../services/aiService.js';

// --- Subject Management ---
export const createSubject = (name) => {
  return prisma.subject.create({ data: { name } });
};

export const getAllSubjects = () => {
  return prisma.subject.findMany({
    include: { _count: { select: { topics: true } } }
  });
};

// --- Topic Management ---
export const createTopic = (name, subjectId) => {
  return prisma.topic.create({ data: { name, subjectId } });
};

export const getTopics = (subjectId) => {
  return prisma.topic.findMany({
    where: { subjectId },
    include: { _count: { select: { content: true } } }
  });
};

// --- Content Management ---
export const addContent = (topicId, content) => {
  return prisma.contentBlock.create({ data: { topicId, content } });
};

export const getContent = (topicId) => {
  return prisma.contentBlock.findMany({
    where: { topicId },
    orderBy: { id: 'asc' }
  });
};

export const deleteContent = (blockId) => {
  return prisma.contentBlock.delete({ where: { id: blockId } });
};


// --- [NEW] Quiz Management ---

/**
 * --- UPDATED ---
 * Generates a new quiz for a topic using AI and saves it to DB.
 * This NO LONGER deletes old quizzes. It just adds a new one.
 */
export const generateQuiz = async (topicId) => {
  // 1. Get all content blocks for the topic
  const contentBlocks = await prisma.contentBlock.findMany({
    where: { topicId },
  });

  if (contentBlocks.length === 0) {
    throw new Error('This topic has no content. Add content before generating a quiz.');
  }

  // 2. Combine content into a single string
  const context = contentBlocks.map((block) => block.content).join('\n\n');

  // 3. Call AI service to generate questions
  const questions = await generateQuizFromContent(context);

  if (!questions || questions.length === 0) {
    throw new Error('AI failed to generate questions.');
  }

  // 4. --- REMOVED ---
  // We no longer delete old quizzes.
  // await prisma.quiz.deleteMany({
  //   where: { topicId },
  // });

  // 5. Create new quiz and questions in a transaction
  const newQuiz = await prisma.quiz.create({
    data: {
      topicId: topicId,
      questions: {
        create: questions.map((q) => ({
          questionText: q.questionText,
          options: q.options, // Prisma stores this as JSON
          correctAnswerIndex: q.correctAnswerIndex,
        })),
      },
    },
    include: {
      questions: true, // Return the new quiz with its questions
    },
  });

  return newQuiz;
};

/**
 * --- UPDATED ---
 * Gets ALL quizzes for a specific topic (includes questions)
 */
export const getQuizzesForTopic = (topicId) => {
  return prisma.quiz.findMany({ // <-- Was findUnique
    where: { topicId },
    include: {
      questions: {
        orderBy: { id: 'asc' },
      },
    },
    orderBy: {
      createdAt: 'desc' // Show newest quizzes first
    }
  });
};

/**
 * Deletes a quiz and all its associated questions
 */
export const deleteQuiz = (quizId) => {
  // Related questions are deleted automatically due to `onDelete: Cascade`
  return prisma.quiz.delete({
    where: { id: quizId },
  });
};

export const processBookUpload = async (topicId, fileBuffer) => {
  // 1. Read the text from the file buffer
  const fullText = fileBuffer.toString('utf-8');
  if (!fullText.trim()) {
    throw new Error('Uploaded file is empty.');
  }

  // 2. Call AI service to chunk the content
  const contentChunks = await chunkContentForLearning(fullText);

  if (!contentChunks || contentChunks.length === 0) {
    throw new Error('AI failed to process the document into blocks.');
  }

  // 3. Prepare data for batch-creation
  const blocksToCreate = contentChunks.map(chunk => ({
    content: chunk,
    topicId: topicId,
  }));

  // 4. Save all new blocks to the database in a single transaction
  const result = await prisma.contentBlock.createMany({
    data: blocksToCreate,
  });

  // 5. Return the number of blocks created
  return result.count;
};