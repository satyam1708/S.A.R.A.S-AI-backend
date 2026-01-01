import prisma from "../../lib/prisma.js";

export const createQuestion = async (data) => {
  const { 
    topicId, 
    questionText, 
    options, 
    correctIndex, 
    difficulty, 
    explanation, 
    mockTestId, 
    marks = 1,  
    negative = 0 
  } = data;

  // 1. Create the base question
  const question = await prisma.questionBank.create({
    data: {
      topicId: parseInt(topicId),
      questionText,
      options, // Validated as array by Zod
      correctIndex: parseInt(correctIndex),
      difficulty,
      explanation
    }
  });

  // 2. If a Mock Test ID is provided, link it immediately
  if (mockTestId) {
    await prisma.mockTestQuestion.create({
      data: {
        mockTestId: parseInt(mockTestId),
        questionId: question.id,
        marks: parseFloat(marks),
        negative: parseFloat(negative)
      }
    });
  }

  return question;
};

export const getQuestions = async (page = 1, limit = 10, filters = {}) => {
  const p = parseInt(page) || 1;
  const l = parseInt(limit) || 10;
  const skip = (p - 1) * l;
  
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
      take: l,
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
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l)
    }
  };
};

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
      correctIndex: data.correctIndex !== undefined ? parseInt(data.correctIndex) : undefined,
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