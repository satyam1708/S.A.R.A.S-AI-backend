// src/modules/gs/gs.service.js
import prisma from "../../lib/prisma.js";
import { toSql } from 'pgvector/pg';
import {
  getChatCompletion,
  getChatCompletionStream,
  getEmbedding
} from "../../services/aiService.js";

// Get all subjects and their nested topics for the UI
export const getSubjectsAndTopics = async () => {
  return prisma.subject.findMany({
    include: {
      // 1. Fetch Chapters and their nested topics
      chapters: {
        include: {
          topics: {
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
          }
        },
        orderBy: { name: 'asc' }
      },
      // 2. Fetch "Direct" Topics (those NOT in any chapter)
      topics: {
        where: { chapterId: null }, // Only get topics that don't belong to a chapter
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      },
    },
    orderBy: { name: 'asc' }
  });
};

/**
 * Gets the chat history for a specific user and topic.
 */
export const getChatHistory = async (userId, topicId) => {
  // 1. Find the chat session linking the user and topic
  const session = await prisma.chatSession.findUnique({
    where: {
      userId_topicId: {
        userId: userId,
        topicId: topicId,
      },
    },
  });

  // 2. If no session exists, there is no history.
  if (!session) {
    // Check if the topic itself exists
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) {
      throw new Error("Topic not found.");
    }
    return []; // No history for this user and topic yet
  }

  // 3. Return all messages for that session
  return prisma.chatMessage.findMany({
    where: {
      sessionId: session.id,
    },
    orderBy: { createdAt: "asc" },
  });
};

/**
 * --- OPTIMIZED RAG LOGIC ---
 * Retrives context based on vector similarity.
 * Filters out irrelevant blocks to prevent AI hallucinations.
 */
const getRagContext = async (topicId, userMessage) => {
  // 1. Get embedding for the user's question
  const embedding = await getEmbedding(userMessage);

  // 2. Find the 5 most relevant content blocks using Cosine Similarity
  // We select the 'distance' to filter out weak matches.
  // <=> operator returns cosine distance (0 is identical, 2 is opposite)
  const relevantBlocks = await prisma.$queryRaw`
    SELECT "content", ("vector" <=> ${toSql(embedding)}::vector) as distance
    FROM "ContentBlock"
    WHERE "topicId" = ${topicId}
    ORDER BY distance ASC
    LIMIT 5
  `;

  // 3. Filter out garbage/irrelevant blocks
  // A threshold of 0.5 is generally good for OpenAi embeddings. 
  // If distance > 0.5, the content is likely not very relevant to the query.
  const goodBlocks = relevantBlocks.filter(b => b.distance < 0.5);

  // 4. Build the context string
  if (goodBlocks.length === 0) {
    // Don't send generic "No context" text that might confuse the AI.
    // Returning empty string allows AI to rely on its internal knowledge + chat history.
    return ""; 
  }
  
  return goodBlocks.map((c) => c.content).join("\n---\n");
};

/**
 * Posts a new message and gets an AI response.
 */
export const postNewMessage = async (userId, topicId, userMessage) => {
  // 1. Get the topic (to check if it exists)
  const topic = await prisma.topic.findFirst({
    where: { id: topicId }
  });
  if (!topic) throw new Error("Topic not found");

  // 2. Find or create the ChatSession
  const session = await prisma.chatSession.upsert({
    where: { userId_topicId: { userId: userId, topicId: topicId } },
    create: { userId: userId, topicId: topicId },
    update: {},
  });

  // 3. Get ONLY relevant context
  const context = await getRagContext(topicId, userMessage);
  
  // 4. Get chat history
  const history = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  // 5. Create the AI prompt
  // We only add the Context section if valid context exists
  let systemMessage = `You are SarvaGyaan, an expert tutor for Indian competitive exams (UPSC, SSC). Answer the user's question clearly and concisely.`;
  
  if (context) {
    systemMessage += `\n\nUse the following CONTEXT to answer the question. If the answer is not in the context, use your general knowledge but prioritize the context.\n\nCONTEXT:\n${context}`;
  }

  const messages = [
    { role: "system", content: systemMessage },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: userMessage },
  ];

  // 6. Get AI response
  const aiResponse = await getChatCompletion(messages);

  // 7. Save messages to DB
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

/**
 * Streams a new message response.
 */
export const streamNewMessage = async (userId, topicId, userMessage) => {
  // 1. Get the topic
  const topic = await prisma.topic.findFirst({
    where: { id: topicId }
  });
  if (!topic) throw new Error("Topic not found");

  // 2. Find or create the ChatSession
  const session = await prisma.chatSession.upsert({
    where: { userId_topicId: { userId: userId, topicId: topicId } },
    create: { userId: userId, topicId: topicId },
    update: {},
  });

  // 3. Get relevant context (Optimized)
  const context = await getRagContext(topicId, userMessage);

  // 4. Get chat history
  const history = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  // 5. Create the AI prompt
  let systemMessage = `You are SarvaGyaan, an expert tutor for Indian competitive exams. Answer clearly.`;
  if (context) {
    systemMessage += `\n\nCONTEXT:\n${context}`;
  }

  const messages = [
    { role: "system", content: systemMessage },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: userMessage },
  ];

  // 6. Save the USER'S message to the DB first
  await prisma.chatMessage.create({
    data: { role: "user", content: userMessage, sessionId: session.id },
  });

  // 7. Get the AI response STREAM
  const stream = await getChatCompletionStream(messages);

  // 8. Return both the stream and the session ID
  return { stream, sessionId: session.id };
};

// Save the AI response after streaming
export const saveAiResponse = async (sessionId, aiMessage) => {
  return prisma.chatMessage.create({
    data: {
      role: "assistant",
      content: aiMessage,
      sessionId: sessionId,
    },
  });
};

// Mark a topic as learned
export const markTopicAsLearned = async (userId, topicId) => {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId },
  });

  if (!topic) throw new Error("Topic not found");

  return prisma.learningHistory.upsert({
    where: { userId_topicId: { userId, topicId } },
    update: { hasLearned: true },
    create: { userId, topicId, hasLearned: true },
  });
};

// Generate a revision question
export const getRevisionForUser = async (userId) => {
  // 1. Find all topics the user has learned
  const learnedTopics = await prisma.topic.findMany({
    where: {
      learnedBy: {
        some: {
          userId: userId,
        }, 
      },
    },
    include: {
      content: {
        take: 5, 
      },
    },
  });

  if (learnedTopics.length === 0) {
    return "You haven't marked any topics as 'learned' yet. Once you do, I can help you revise them!";
  }

  // 2. Combine the content from all learned topics
  const context = learnedTopics
    .map(
      (topic) =>
        `Topic: ${topic.name}\n${topic.content.map((c) => c.content).join("\n")}`
    )
    .join("\n---\n");

  if (!context.trim()) {
    return "You've learned some topics, but they don't have any revision content yet. Please check back later.";
  }

  // 3. Create the AI prompt
  const messages = [
    {
      role: "system",
      content: `You are SarvaGyaan, a revision tutor for UPSC/SSC exams. Ask the user ONE concise multiple-choice question (MCQ) or fill-in-the-blank question based on the following context.
CONTEXT:
${context}`,
    },
  ];

  // 4. Get the AI response
  const revisionQuestion = await getChatCompletion(messages);
  return revisionQuestion;
};

/**
 * Creates a new topic from context (e.g. News Article)
 */
export const createTopicFromContext = async (userId, context) => {
  // 1. Get the "General" Subject.
  const generalSubject = await prisma.subject.findUnique({
    where: { name: "General" },
  });

  if (!generalSubject) {
    console.error(
      "FATAL ERROR: The 'General' subject was not found in the database."
    );
    throw new Error("Server configuration error: Default subject not found.");
  }

  // 2. Create AI prompt
  const initialPrompt = `
    A student wants to learn about a topic from a news article titled: "${context}"
    This is for UPSC/SSC exam preparation.
    
    Respond in two parts, separated by "---":
    1.  First, on a single line, provide a short, academic topic name for this article (e.g., "Quantum Computing Basics").
    2.  Second, after "---", write a friendly, simple explanation of this topic for a beginner, starting with a greeting. "Hello! Let's discuss..."
  `;

  // 3. Call AI
  const messages = [{ role: "system", content: initialPrompt }];
  const aiResponse = await getChatCompletion(messages);

  // 4. Parse response
  const responseParts = aiResponse.split("---", 2);
  let topicName;
  let initialMessage;

  if (responseParts.length === 2) {
    topicName = responseParts[0].trim();
    initialMessage = responseParts[1].trim();
  } else {
    topicName = context.substring(0, 50);
    initialMessage =
      "Hello! Let's talk about that topic. What would you like to know first?";
  }

  // 5. Create the new Topic in the database
  const newTopic = await prisma.topic.create({
    data: {
      name: topicName,
      subjectId: generalSubject.id, 
    },
  });

  // 6. Create the ChatSession
  const newSession = await prisma.chatSession.create({
    data: {
      userId: userId,
      topicId: newTopic.id,
    },
  });

  // 7. Save the AI's first message
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
          // We intentionally DO NOT select correctAnswerIndex
        },
        orderBy: { id: "asc" },
      },
      _count: {
        select: { questions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!quizzes || quizzes.length === 0) {
    return []; 
  }

  return quizzes.map((quiz) => {
    const { _count, ...rest } = quiz;
    return {
      ...rest,
      totalQuestions: _count.questions,
    };
  });
};

export const checkAnswer = async (questionId, selectedAnswerIndex) => {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, correctAnswerIndex: true },
  });

  if (!question) {
    throw new Error("Question not found.");
  }

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
    include: {
      questions: {
        select: { id: true, correctAnswerIndex: true },
      },
    },
  });

  if (!quiz) {
    throw new Error("Quiz not found.");
  }

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

    if (isCorrect) {
      score++;
    }

    userAnswersData.push({
      questionId: answer.questionId,
      selectedAnswerIndex: answer.selectedAnswerIndex,
      isCorrect: isCorrect,
    });
  }

  const attempt = await prisma.userQuizAttempt.create({
    data: {
      userId: userId,
      quizId: quizId,
      score: score,
      total: total,
      answers: {
        create: userAnswersData, 
      },
    },
    include: {
      answers: true, 
    },
  });

  return attempt;
};

const calculateNextReview = (strength) => {
  const now = new Date();
  const intervals = [
    10 * 60 * 1000, // 10 min
    24 * 60 * 60 * 1000, // 1 day
    3 * 24 * 60 * 60 * 1000, // 3 days
    7 * 24 * 60 * 60 * 1000, // 7 days
    14 * 24 * 60 * 60 * 1000, // 14 days
    30 * 24 * 60 * 60 * 1000, // 30 days
    90 * 24 * 60 * 60 * 1000, // 90 days
  ];

  const intervalIndex = Math.min(strength, intervals.length - 1);
  const millisecondsToAdd = intervals[intervalIndex];

  return new Date(now.getTime() + millisecondsToAdd);
};

export const getDueFlashcards = async (userId) => {
  const now = new Date();

  // 1. Get cards already in the user's study deck that are due
  const dueCards = await prisma.userFlashcardStudy.findMany({
    where: {
      userId: userId,
      nextReviewAt: {
        lte: now, 
      },
    },
    include: {
      flashcard: true, 
    },
    orderBy: {
      nextReviewAt: "asc", 
    },
  });

  // 2. Get new cards from topics the user has learned
  const learnedTopics = await prisma.learningHistory.findMany({
    where: { userId: userId, hasLearned: true },
    select: { topicId: true },
  });
  const learnedTopicIds = learnedTopics.map((t) => t.topicId);

  if (learnedTopicIds.length === 0) {
    return dueCards.map((study) => study.flashcard);
  }

  // Find flashcards for learned topics that the user has *not* studied yet
  const newFlashcards = await prisma.flashcard.findMany({
    where: {
      topicId: {
        in: learnedTopicIds,
      },
      userStudies: {
        none: {
          userId: userId,
        },
      },
    },
  });

  // 3. Combine and return
  const allDueFlashcards = [
    ...dueCards.map((study) => study.flashcard),
    ...newFlashcards,
  ];

  // Simple shuffle to mix new and due cards
  return allDueFlashcards.sort(() => Math.random() - 0.5);
};

export const reviewFlashcard = async (userId, flashcardId, rating) => {
  const study = await prisma.userFlashcardStudy.upsert({
    where: {
      userId_flashcardId: {
        userId: userId,
        flashcardId: flashcardId,
      },
    },
    create: {
      userId: userId,
      flashcardId: flashcardId,
      strength: 0,
      lastReviewed: new Date(),
      nextReviewAt: new Date(), 
    },
    update: {},
  });

  let newStrength = study.strength;

  switch (rating) {
    case 0: // 'Again'
      newStrength = 0;
      break;
    case 1: // 'Good'
      newStrength += 1; 
      break;
    case 2: // 'Easy'
      newStrength += 2; 
      break;
    default:
      throw new Error("Invalid rating. Must be 0, 1, or 2.");
  }

  const nextReviewAt = calculateNextReview(newStrength);

  return prisma.userFlashcardStudy.update({
    where: {
      id: study.id,
    },
    data: {
      strength: newStrength,
      lastReviewed: new Date(),
      nextReviewAt: nextReviewAt,
    },
  });
};
