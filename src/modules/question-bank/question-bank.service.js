import prisma from "../../lib/prisma.js";

// 1. Get Questions with Pagination & Filters
export const getQuestions = async (page = 1, limit = 10, filters = {}) => {
  const skip = (page - 1) * limit;
  //
  const { search, topicId, difficulty, mockTestId } = filters;

  const where = {};

  if (search) {
    where.questionText = { contains: search, mode: 'insensitive' };
  }
  if (topicId) {
    where.topicId = parseInt(topicId);
  }
  if (difficulty) {
    where.difficulty = difficulty.toUpperCase();
  }
  //
  if (mockTestId) {
    where.usedInMocks = {
      some: {
        mockTestId: parseInt(mockTestId)
      }
    };
  }

  const [questions, total] = await Promise.all([
    prisma.questionBank.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        topic: {
          select: { name: true, subject: { select: { name: true } } }
        }
      }
    }),
    prisma.questionBank.count({ where })
  ]);

  return {
    data: questions,
    meta: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }
  };
};

// ... (keep getQuestionById, updateQuestion, deleteQuestion as is)
export const getQuestionById = async (id) => {
  return await prisma.questionBank.findUnique({
    where: { id: parseInt(id) },
    include: { topic: true }
  });
};

export const updateQuestion = async (id, data) => {
  return await prisma.questionBank.update({
    where: { id: parseInt(id) },
    data: {
      questionText: data.questionText,
      options: data.options,
      correctIndex: parseInt(data.correctIndex),
      explanation: data.explanation,
      difficulty: data.difficulty,
      topicId: data.topicId ? parseInt(data.topicId) : undefined
    }
  });
};

export const deleteQuestion = async (id) => {
  return await prisma.questionBank.delete({
    where: { id: parseInt(id) }
  });
};