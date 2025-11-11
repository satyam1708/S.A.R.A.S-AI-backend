import prisma from '../../lib/prisma.js';
import { getChatCompletion, getChatCompletionStream } from '../../services/aiService.js';

// Get all subjects and their nested topics for the UI
export const getSubjectsAndTopics = async () => {
  // This function is correct.
  return prisma.subject.findMany({
    include: {
      topics: {
        select: { id: true, name: true },
        // where: { userId: null }, // <-- This logic is no longer valid, Topic has no userId.
                                 //     We'll just get all topics.
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
      throw new Error('Topic not found.');
    }
    return []; // No history for this user and topic yet
  }

  // 3. Return all messages for that session
  return prisma.chatMessage.findMany({
    where: {
      sessionId: session.id,
    },
    orderBy: { createdAt: 'asc' },
  });
};

/**
 * --- CORRECTED ---
 * Posts a new message and gets an AI response.
 * This now correctly saves messages to a ChatSession.
 */
export const postNewMessage = async (userId, topicId, userMessage) => {
  // 1. Get the knowledge context for this topic
  const topic = await prisma.topic.findFirst({
    where: { id: topicId },
    include: { content: true },
  });

  if (!topic) throw new Error('Topic not found');

  // 2. Find or create the ChatSession for this user and topic
  const session = await prisma.chatSession.upsert({
    where: {
      userId_topicId: {
        userId: userId,
        topicId: topicId,
      },
    },
    create: { userId: userId, topicId: topicId },
    update: {}, // No update needed, just need the session
  });

  const context =
    topic.content.length > 0
      ? topic.content.map((c) => c.content).join('\n---\n')
      : 'No specific context provided for this topic. Answer based on general knowledge.';

  // 3. Get chat history (now from the session)
  const history = await prisma.chatMessage.findMany({
    where: {
      sessionId: session.id,
    },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  // 4. Create the AI prompt
  const systemMessage = `You are SarvaGyaan, an expert tutor.
You are teaching the user about "${topic.name}".
You MUST answer using ONLY the provided CONTEXT.
If the answer is not in the CONTEXT, say: "I'm sorry, that is outside my current knowledge for this topic."

CONTEXT:
${context}`;

  const messages = [
    { role: 'system', content: systemMessage },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: userMessage },
  ];

  // 5. Get AI response
  const aiResponse = await getChatCompletion(messages);

  // 6. Save messages to DB (linked to the session)
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        role: 'user',
        content: userMessage,
        sessionId: session.id, // <-- FIX: Use sessionId
      },
    }),
    prisma.chatMessage.create({
      data: {
        role: 'assistant',
        content: aiResponse,
        sessionId: session.id, // <-- FIX: Use sessionId
      },
    }),
  ]);

  return aiResponse;
};

export const streamNewMessage = async (userId, topicId, userMessage) => {
  // 1. Get the knowledge context for this topic
  const topic = await prisma.topic.findFirst({
    where: { id: topicId },
    include: { content: true },
  });

  if (!topic) throw new Error('Topic not found');

  // 2. Find or create the ChatSession for this user and topic
  const session = await prisma.chatSession.upsert({
    where: { userId_topicId: { userId: userId, topicId: topicId } },
    create: { userId: userId, topicId: topicId },
    update: {},
  });

  const context =
    topic.content.length > 0
      ? topic.content.map((c) => c.content).join('\n---\n')
      : 'No specific context provided for this topic. Answer based on general knowledge.';

  // 3. Get chat history (now from the session)
  const history = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  // 4. Create the AI prompt
  const systemMessage = `You are SarvaGyaan, an expert tutor.
You are teaching the user about "${topic.name}".
You MUST answer using ONLY the provided CONTEXT.
If the answer is not in the CONTEXT, say: "I'm sorry, that is outside my current knowledge for this topic."

CONTEXT:
${context}`;

  const messages = [
    { role: 'system', content: systemMessage },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: userMessage },
  ];
  
  // 5. Save the USER'S message to the DB first
  await prisma.chatMessage.create({
    data: {
      role: 'user',
      content: userMessage,
      sessionId: session.id,
    },
  });

  // 6. Get the AI response STREAM
  const stream = await getChatCompletionStream(messages);

  // 7. Return both the stream and the session ID
  return { stream, sessionId: session.id };
};

// +++ 4. ADD THIS NEW FUNCTION to save the AI response after streaming +++
export const saveAiResponse = async (sessionId, aiMessage) => {
  return prisma.chatMessage.create({
    data: {
      role: 'assistant',
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

  if (!topic) throw new Error('Topic not found');

  return prisma.learningHistory.upsert({
    where: { userId_topicId: { userId, topicId } },
    update: { hasLearned: true },
    create: { userId, topicId, hasLearned: true },
  });
};

// Generate a revision question
export const getRevisionForUser = async (userId) => {
  // This function was also correct
  const learnedTopics = await prisma.topic.findMany({
    where: {
      learnedBy: {
        some: { userId: userId, hasLearned: true },
      },
    },
    include: { content: true },
  });

  if (learnedTopics.length === 0) {
    return "You haven't marked any topics as 'learned' yet. Once you do, I can help you revise them!";
  }

  const context = learnedTopics
    .map(
      (topic) =>
        `Topic: ${topic.name}\n${topic.content.map((c) => c.content).join('\n')}`
    )
    .join('\n---\n');

  const messages = [
    {
      role: 'system',
      content: `You are SarvaGyaan, a revision tutor. Ask the user ONE concise question based on the following context.
CONTEXT:
${context}`,
    },
  ];

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
    where: { name: 'General' },
  });

  if (!generalSubject) {
    console.error("FATAL ERROR: The 'General' subject was not found in the database.");
    throw new Error(
      "Server configuration error: Default subject not found."
    );
  }

  // 2. Create AI prompt
  const initialPrompt = `
    A user was just reading an article titled: "${context}"
    
    Respond in two parts, separated by "---":
    1.  First, on a single line, provide a short topic name (3-5 words) for this article (e.g., "Quantum Computing").
    2.  Second, after "---", write a friendly, simple explanation of this topic for a beginner, starting with a greeting.
  `;

  // 3. Call AI
  const messages = [{ role: 'system', content: initialPrompt }];
  const aiResponse = await getChatCompletion(messages);

  // 4. Parse response
  const responseParts = aiResponse.split('---', 2);
  let topicName;
  let initialMessage;

  if (responseParts.length === 2) {
    topicName = responseParts[0].trim();
    initialMessage = responseParts[1].trim();
  } else {
    topicName = context.substring(0, 50);
    initialMessage = "Hello! Let's talk about that topic. What would you like to know first?";
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
      role: 'assistant',
      content: initialMessage,
      sessionId: newSession.id, // <-- FIX: Use the new sessionId
    },
  });

  // 8. Return the new topic object
  return newTopic;
};