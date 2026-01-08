// src/modules/gs/gs.service.js
import prisma from "../../lib/prisma.js";
import { toSql } from "pgvector/pg";
import logger from "../../lib/logger.js";
import {
  getChatCompletion,
  getChatCompletionStream,
  getEmbedding,
  generateEducationalImage,
} from "../../services/aiService.js";

// [NEW] Generate Image and Save History
export const generateAndSaveImage = async (userId, topicId, prompt) => {
  const session = await prisma.chatSession.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: { userId, topicId },
    update: {},
  });

  await prisma.chatMessage.create({
    data: {
      role: "user",
      content: `Generate an image for: ${prompt}`,
      sessionId: session.id,
    },
  });

  // Resilient call handled by aiService wrapper
  const imageUrl = await generateEducationalImage(prompt);

  const aiMessage = await prisma.chatMessage.create({
    data: {
      role: "assistant",
      content: "Here is the visualization you requested:",
      imageUrl: imageUrl,
      sessionId: session.id,
    },
  });

  return aiMessage;
};

// Get all subjects and their nested topics for the UI
export const getSubjectsAndTopics = async () => {
  return prisma.subject.findMany({
    include: {
      chapters: {
        include: {
          topics: {
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
      topics: {
        where: { chapterId: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
};

export const getChatHistory = async (userId, topicId) => {
  const session = await prisma.chatSession.findUnique({
    where: {
      userId_topicId: { userId, topicId },
    },
  });

  if (!session) {
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new Error("Topic not found.");
    return [];
  }

  return prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
  });
};

const getRagContext = async (topicId, userMessage) => {
  const embedding = await getEmbedding(userMessage);

  const relevantBlocks = await prisma.$queryRaw`
    SELECT "content", ("vector" <=> ${toSql(embedding)}::vector) as distance
    FROM "ContentBlock"
    WHERE "topicId" = ${topicId}
    ORDER BY distance ASC
    LIMIT 5
  `;

  const goodBlocks = relevantBlocks.filter((b) => b.distance < 0.5);

  if (goodBlocks.length === 0) return "";

  return goodBlocks.map((c) => c.content).join("\n---\n");
};

export const postNewMessage = async (userId, topicId, userMessage) => {
  const topic = await prisma.topic.findFirst({ where: { id: topicId } });
  if (!topic) throw new Error("Topic not found");

  const session = await prisma.chatSession.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: { userId, topicId },
    update: {},
  });

  const context = await getRagContext(topicId, userMessage);

  const history = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  let systemMessage = `You are SarvaGyaan, an expert voice tutor for Indian competitive exams (UPSC, SSC).
  
  VOICE RULES:
  1. You are speaking, not writing. Do NOT use Markdown (no **bold**, no # headers, no - lists).
  2. Keep your response conversational and concise.
  3. Start with a short, direct sentence to ensure audio starts playing immediately.
  4. Avoid long monologues. Ask a follow-up question if appropriate.
  `;

  if (context) {
    systemMessage += `\n\nCONTEXT:\n${context}\n\nUse this context to answer. If the answer is missing, use general knowledge.`;
  }

  const messages = [
    { role: "system", content: systemMessage },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: userMessage },
  ];

  const aiResponse = await getChatCompletion(messages);

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { role: "user", content: userMessage, sessionId: session.id },
    }),
    prisma.chatMessage.create({
      data: { role: "assistant", content: aiResponse, sessionId: session.id },
    }),
  ]);

  return aiResponse;
};

export const streamNewMessage = async (userId, topicId, userMessage) => {
  const topic = await prisma.topic.findFirst({ where: { id: topicId } });
  if (!topic) throw new Error("Topic not found");

  const session = await prisma.chatSession.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: { userId, topicId },
    update: {},
  });

  const context = await getRagContext(topicId, userMessage);

  const history = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  let systemMessage = `You are SarvaGyaan, a voice tutor.
  CRITICAL: Do NOT use Markdown. No bold text, no headers, no bullet points.
  Speak naturally. Keep your first sentence short.
  Explain the concept simply as if talking to a student.`;

  if (context) {
    systemMessage += `\n\nInfo:\n${context}`;
  }

  const messages = [
    { role: "system", content: systemMessage },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: userMessage },
  ];

  await prisma.chatMessage.create({
    data: { role: "user", content: userMessage, sessionId: session.id },
  });

  const stream = await getChatCompletionStream(messages);

  return { stream, sessionId: session.id };
};

export const saveAiResponse = async (sessionId, aiMessage) => {
  return prisma.chatMessage.create({
    data: {
      role: "assistant",
      content: aiMessage,
      sessionId: sessionId,
    },
  });
};

export const markTopicAsLearned = async (userId, topicId) => {
  const topic = await prisma.topic.findFirst({ where: { id: topicId } });
  if (!topic) throw new Error("Topic not found");

  return prisma.learningHistory.upsert({
    where: { userId_topicId: { userId, topicId } },
    update: { hasLearned: true },
    create: { userId, topicId, hasLearned: true },
  });
};

export const getRevisionForUser = async (userId) => {
  const learnedTopics = await prisma.topic.findMany({
    where: {
      learnedBy: { some: { userId: userId } },
    },
    include: { content: { take: 5 } },
  });

  if (learnedTopics.length === 0) {
    return "You haven't marked any topics as 'learned' yet. Once you do, I can help you revise them!";
  }

  const context = learnedTopics
    .map(
      (topic) =>
        `Topic: ${topic.name}\n${topic.content.map((c) => c.content).join("\n")}`
    )
    .join("\n---\n");

  if (!context.trim()) {
    return "You've learned some topics, but they don't have any revision content yet. Please check back later.";
  }

  const messages = [
    {
      role: "system",
      content: `You are SarvaGyaan, a revision tutor for UPSC/SSC exams. Ask the user ONE concise multiple-choice question (MCQ) or fill-in-the-blank question based on the following context.
CONTEXT:
${context}`,
    },
  ];

  const revisionQuestion = await getChatCompletion(messages);
  return revisionQuestion;
};

export const createTopicFromContext = async (userId, context) => {
  const generalSubject = await prisma.subject.findUnique({
    where: { name: "General" },
  });

  if (!generalSubject) {
    logger.error(
      "FATAL ERROR: The 'General' subject was not found in the database."
    );
    throw new Error("Server configuration error: Default subject not found.");
  }

  const initialPrompt = `
    A student wants to learn about a topic from a news article titled: "${context}"
    This is for UPSC/SSC exam preparation.
    
    Respond in two parts, separated by "---":
    1.  First, on a single line, provide a short, academic topic name for this article (e.g., "Quantum Computing Basics").
    2.  Second, after "---", write a friendly, simple explanation of this topic for a beginner, starting with a greeting. "Hello! Let's discuss..."
  `;

  const messages = [{ role: "system", content: initialPrompt }];
  const aiResponse = await getChatCompletion(messages);

  const responseParts = aiResponse.split("---", 2);
  let topicName, initialMessage;

  if (responseParts.length === 2) {
    topicName = responseParts[0].trim();
    initialMessage = responseParts[1].trim();
  } else {
    topicName = context.substring(0, 50);
    initialMessage =
      "Hello! Let's talk about that topic. What would you like to know first?";
  }

  const newTopic = await prisma.topic.create({
    data: { name: topicName, subjectId: generalSubject.id },
  });

  const newSession = await prisma.chatSession.create({
    data: { userId: userId, topicId: newTopic.id },
  });

  await prisma.chatMessage.create({
    data: {
      role: "assistant",
      content: initialMessage,
      sessionId: newSession.id,
    },
  });

  return newTopic;
};

// --- STUDENT QUIZ FUNCTIONS ---

export const getQuizzesForTopic = async (topicId) => {
  const quizzes = await prisma.quiz.findMany({
    where: { topicId: topicId },
    include: {
      questions: {
        select: {
          id: true,
          questionText: true,
          options: true,
        },
        orderBy: { id: "asc" },
      },
      _count: { select: { questions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!quizzes) return [];

  return quizzes.map((quiz) => {
    const { _count, ...rest } = quiz;
    return { ...rest, totalQuestions: _count.questions };
  });
};

export const checkAnswer = async (questionId, selectedAnswerIndex) => {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, correctAnswerIndex: true },
  });

  if (!question) throw new Error("Question not found.");

  const isCorrect = question.correctAnswerIndex === selectedAnswerIndex;

  return {
    questionId: question.id,
    isCorrect: isCorrect,
    correctAnswerIndex: question.correctAnswerIndex,
  };
};

export const submitQuiz = async (userId, quizId, answers) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { select: { id: true, correctAnswerIndex: true } } },
  });

  if (!quiz) throw new Error("Quiz not found.");

  const correctAnswersMap = new Map();
  quiz.questions.forEach((q) => {
    correctAnswersMap.set(q.id, q.correctAnswerIndex);
  });

  let score = 0;
  const total = quiz.questions.length;
  const userAnswersData = [];

  for (const answer of answers) {
    const correctAnswerIndex = correctAnswersMap.get(answer.questionId);
    const isCorrect = answer.selectedAnswerIndex === correctAnswerIndex;
    if (isCorrect) score++;

    userAnswersData.push({
      questionId: answer.questionId,
      selectedAnswerIndex: answer.selectedAnswerIndex,
      isCorrect: isCorrect,
    });
  }

  return prisma.userQuizAttempt.create({
    data: {
      userId: userId,
      quizId: quizId,
      score: score,
      total: total,
      answers: { create: userAnswersData },
    },
    include: { answers: true },
  });
};

const calculateNextReview = (strength) => {
  const now = new Date();
  const intervals = [
    10 * 60 * 1000,
    24 * 60 * 60 * 1000,
    3 * 24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
    14 * 24 * 60 * 60 * 1000,
    30 * 24 * 60 * 60 * 1000,
    90 * 24 * 60 * 60 * 1000,
  ];
  const intervalIndex = Math.min(strength, intervals.length - 1);
  return new Date(now.getTime() + intervals[intervalIndex]);
};

export const getDueFlashcards = async (userId) => {
  const now = new Date();

  const dueCards = await prisma.userFlashcardStudy.findMany({
    where: { userId: userId, nextReviewAt: { lte: now } },
    include: { flashcard: true },
    orderBy: { nextReviewAt: "asc" },
  });

  const learnedTopics = await prisma.learningHistory.findMany({
    where: { userId: userId, hasLearned: true },
    select: { topicId: true },
  });
  const learnedTopicIds = learnedTopics.map((t) => t.topicId);

  if (learnedTopicIds.length === 0) {
    return dueCards.map((study) => study.flashcard);
  }

  const newFlashcards = await prisma.flashcard.findMany({
    where: {
      topicId: { in: learnedTopicIds },
      userStudies: { none: { userId: userId } },
    },
  });

  const allDueFlashcards = [
    ...dueCards.map((study) => study.flashcard),
    ...newFlashcards,
  ];

  return allDueFlashcards.sort(() => Math.random() - 0.5);
};

export const reviewFlashcard = async (userId, flashcardId, rating) => {
  const study = await prisma.userFlashcardStudy.upsert({
    where: { userId_flashcardId: { userId, flashcardId } },
    create: {
      userId,
      flashcardId,
      strength: 0,
      lastReviewed: new Date(),
      nextReviewAt: new Date(),
    },
    update: {},
  });

  let newStrength = study.strength;
  switch (rating) {
    case 0:
      newStrength = 0;
      break;
    case 1:
      newStrength += 1;
      break;
    case 2:
      newStrength += 2;
      break;
    default:
      throw new Error("Invalid rating.");
  }

  return prisma.userFlashcardStudy.update({
    where: { id: study.id },
    data: {
      strength: newStrength,
      lastReviewed: new Date(),
      nextReviewAt: calculateNextReview(newStrength),
    },
  });
};

export const getKnowledgeGraph = async (userId) => {
  return prisma.subject.findMany({
    include: {
      chapters: {
        include: {
          topics: {
            include: {
              learnedBy: {
                where: { userId: userId },
                select: { hasLearned: true }
              }
            }
          }
        }
      },
      // Also include topics that aren't in a chapter
      topics: {
        where: { chapterId: null },
        include: {
          learnedBy: {
            where: { userId: userId },
            select: { hasLearned: true }
          }
        }
      }
    }
  });
};


export const getTopicContentForOffline = async (topicId) => {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { 
      content: {
        select: { content: true } 
      } 
    }
  });

  if (!topic) return "";

  // Combine all content blocks into one large context string for the LLM
  return topic.content.map((b) => b.content).join("\n\n");
};