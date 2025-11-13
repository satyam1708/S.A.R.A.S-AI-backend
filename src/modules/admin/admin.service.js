// src/modules/admin/admin.service.js
import prisma from '../../lib/prisma.js';
import { generateQuizFromContent } from '../../services/aiService.js';

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
 * Generates a new quiz for a topic using AI and saves it to DB.
 * This deletes any existing quiz for that topic.
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
  // This will return an array like: [{ questionText, options, correctAnswerIndex }, ...]
  const questions = await generateQuizFromContent(context);

  if (!questions || questions.length === 0) {
    throw new Error('AI failed to generate questions.');
  }

  // 4. Delete old quiz (if it exists)
  await prisma.quiz.deleteMany({
    where: { topicId },
  });

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
 * Gets the quiz for a specific topic (includes questions)
 */
export const getQuiz = (topicId) => {
  return prisma.quiz.findUnique({
    where: { topicId },
    include: {
      questions: {
        orderBy: { id: 'asc' },
      },
    },
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