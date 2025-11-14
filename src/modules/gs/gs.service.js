import prisma from "../../lib/prisma.js";
import { toSql } from 'pgvector/pg';
import {
  getChatCompletion,
  getChatCompletionStream,
  getEmbedding
} from "../../services/aiService.js";

// Get all subjects and their nested topics for the UI
export const getSubjectsAndTopics = async () => {
  // This function is correct.
  return prisma.subject.findMany({
    include: {
      topics: {
        select: { id: true, name: true },
      },
    },
  });
};

/**
 * --- CORRECTED ---
 * Gets the chat history for a specific user and topic.
 * This now correctly uses the ChatSession model.
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

// --- This is the new, shared logic for RAG retrieval ---
const getRagContext = async (topicId, userMessage) => {
  // 1. Get embedding for the user's question
  const embedding = await getEmbedding(userMessage);

  // 2. Find the 5 most relevant content blocks for this topic
  const relevantBlocks = await prisma.$queryRaw`
    SELECT "content"
    FROM "ContentBlock"
    WHERE "topicId" = ${topicId}
    ORDER BY "vector" <=> ${toSql(embedding)}::vector
    LIMIT 5
  `;

  // 3. Build the context string
  if (!relevantBlocks || relevantBlocks.length === 0) {
    return "No specific context provided for this topic. Answer based on general knowledge.";
  }
  
  return relevantBlocks.map((c) => c.content).join("\n---\n");
};
/**
 * --- CORRECTED ---
 * Posts a new message and gets an AI response.
 * This now correctly saves messages to a ChatSession.
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

  // 3. --- NEW RAG LOGIC ---
  // Get ONLY the relevant context, not all of it
  const context = await getRagContext(topicId, userMessage);
  
  // 4. Get chat history
  const history = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  // 5. Create the AI prompt (same as before)
  const systemMessage = `You are SarvaGyaan...
CONTEXT:
${context}`;

  const messages = [
    { role: "system", content: systemMessage },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: userMessage },
  ];

  // 6. Get AI response (same as before)
  const aiResponse = await getChatCompletion(messages);

  // 7. Save messages to DB (same as before)
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

  // 3. --- NEW RAG LOGIC ---
  const context = await getRagContext(topicId, userMessage);

  // 4. Get chat history
  const history = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  // 5. Create the AI prompt (same as before)
  const systemMessage = `You are SarvaGyaan...
CONTEXT:
${context}`;

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

// +++ 4. ADD THIS NEW FUNCTION to save the AI response after streaming +++
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
  // This function was correct as it uses LearningHistory
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
        // This references the relation on the Topic model
        some: {
          userId: userId, // Find topics where at least one LearningHistory record...
        }, // ...matches this userId
      },
    },
    include: {
      content: {
        // Include the content blocks for those topics
        take: 5, // Limit to 5 content blocks per topic to keep it manageable
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
  // --- NEW EXAM-FOCUSED PERSONA ---
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
 * --- CORRECTED ---
 * This function now creates a new topic under a default "General" subject.
 *
 * !! IMPORTANT !!: You must manually create a Subject in your database
 * with the name "General" for this code to work.
 */
export const createTopicFromContext = async (userId, context) => {
  // 1. Get the "General" Subject.
  //    You MUST create this subject in your database first!
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
  // --- NEW EXAM-FOCUSED PERSONA ---
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
      subjectId: generalSubject.id, // <-- FIX: Provide the required subjectId
      // userId: userId, // <-- FIX: REMOVED. This field does not exist on Topic.
    },
  });

  // 6. Create the ChatSession to link the User, new Topic, and first message
  const newSession = await prisma.chatSession.create({
    data: {
      userId: userId,
      topicId: newTopic.id,
    },
  });

  // 7. Save the AI's first message to the new chat session
  await prisma.chatMessage.create({
    data: {
      role: "assistant",
      content: initialMessage,
      sessionId: newSession.id, // <-- FIX: Use the new sessionId
    },
  });

  // 8. Return the new topic object
  return newTopic;
};

// --- [NEW] STUDENT QUIZ FUNCTIONS ---

/**
 * --- NEW & UPDATED ---
 * Gets ALL quizzes for a topic, but formatted for a student.
 * (i.e., correct answers are REMOVED to prevent cheating)
 */
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
    return []; // Return empty array instead of error
  }

  // Map the quizzes to add the 'total' count to the main object
  return quizzes.map((quiz) => {
    const { _count, ...rest } = quiz;
    return {
      ...rest,
      totalQuestions: _count.questions,
    };
  });
};

/**
 * --- NEW ---
 * Checks a single answer for a user and returns instant feedback.
 * This is how you show the answer immediately.
 */
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
    correctAnswerIndex: question.correctAnswerIndex, // Return the correct answer
  };
};

/**
 * --- NEW ---
 * Submits a user's full quiz attempt and saves the score.
 */
export const submitQuiz = async (userId, quizId, answers) => {
  // 1. Get the quiz and its questions (this time, with correct answers)
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

  // 2. Create a map of correct answers for easy lookup
  const correctAnswersMap = new Map();
  quiz.questions.forEach((q) => {
    correctAnswersMap.set(q.id, q.correctAnswerIndex);
  });

  let score = 0;
  const total = quiz.questions.length;
  const userAnswersData = [];

  // 3. Grade the answers
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

  // 4. Save the full attempt in the database
  const attempt = await prisma.userQuizAttempt.create({
    data: {
      userId: userId,
      quizId: quizId,
      score: score,
      total: total,
      answers: {
        create: userAnswersData, // Create all UserAnswer records
      },
    },
    include: {
      answers: true, // Return the attempt with the answers
    },
  });

  return attempt;
};

const calculateNextReview = (strength) => {
  const now = new Date();
  const intervals = [
    10 * 60 * 1000, // 10 minutes (strength 0 -> 1)
    24 * 60 * 60 * 1000, // 1 day (strength 1 -> 2)
    3 * 24 * 60 * 60 * 1000, // 3 days (strength 2 -> 3)
    7 * 24 * 60 * 60 * 1000, // 7 days (strength 3 -> 4)
    14 * 24 * 60 * 60 * 1000, // 14 days (strength 4 -> 5)
    30 * 24 * 60 * 60 * 1000, // 30 days
    90 * 24 * 60 * 60 * 1000, // 90 days
  ];

  // Cap strength at the max interval length
  const intervalIndex = Math.min(strength, intervals.length - 1);
  const millisecondsToAdd = intervals[intervalIndex];

  return new Date(now.getTime() + millisecondsToAdd);
};

/**
 * Gets all flashcards due for review for a user.
 */
export const getDueFlashcards = async (userId) => {
  const now = new Date();

  // 1. Get cards already in the user's study deck that are due
  const dueCards = await prisma.userFlashcardStudy.findMany({
    where: {
      userId: userId,
      nextReviewAt: {
        lte: now, // Less than or equal to now
      },
    },
    include: {
      flashcard: true, // Include the Q&A text
    },
    orderBy: {
      nextReviewAt: "asc", // Show most overdue first
    },
  });

  // 2. Get new cards from topics the user has learned
  const learnedTopics = await prisma.learningHistory.findMany({
    where: { userId: userId, hasLearned: true },
    select: { topicId: true },
  });
  const learnedTopicIds = learnedTopics.map((t) => t.topicId);

  if (learnedTopicIds.length === 0) {
    // No learned topics, just return the cards they are already studying
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
  // We return the full flashcard object. The frontend will map this.
  const allDueFlashcards = [
    ...dueCards.map((study) => study.flashcard),
    ...newFlashcards,
  ];

  // Simple shuffle to mix new and due cards
  return allDueFlashcards.sort(() => Math.random() - 0.5);
};

/**
 * Reviews a single flashcard and updates its next review date.
 * Rating: 0 = 'Again', 1 = 'Good', 2 = 'Easy'
 */
export const reviewFlashcard = async (userId, flashcardId, rating) => {
  const study = await prisma.userFlashcardStudy.upsert({
    where: {
      userId_flashcardId: {
        userId: userId,
        flashcardId: flashcardId,
      },
    },
    // Create a new study record if this is the first time seeing this card
    create: {
      userId: userId,
      flashcardId: flashcardId,
      strength: 0,
      lastReviewed: new Date(),
      nextReviewAt: new Date(), // Will be updated below
    },
    // Or update the existing one
    update: {},
  });

  let newStrength = study.strength;

  switch (rating) {
    case 0: // 'Again'
      newStrength = 0; // Reset strength
      break;
    case 1: // 'Good'
      newStrength += 1; // Increment strength
      break;
    case 2: // 'Easy'
      newStrength += 2; // Increment strength by 2
      break;
    default:
      throw new Error("Invalid rating. Must be 0, 1, or 2.");
  }

  const nextReviewAt = calculateNextReview(newStrength);

  // Update the study record with new strength and next review date
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
