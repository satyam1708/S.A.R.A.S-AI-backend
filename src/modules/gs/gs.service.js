import prisma from '../../lib/prisma.js';
import { getChatCompletion } from '../../services/aiService.js';

// Get all subjects and their nested topics for the UI
export const getSubjectsAndTopics = async () => {
  return prisma.gsSubject.findMany({ // Corrected model name to GsSubject
    include: {
      topics: {
        select: { id: true, name: true },
        where: { userId: null }, // Only get "template" topics
      },
    },
  });
};

/**
 * --- NEW (Replaces getChatSession) ---
 * Gets the chat history for a specific user and topic.
 */
export const getChatHistory = async (userId, topicId) => {
  // Find the topic and ensure the user owns it (or it's a template)
  const topic = await prisma.gsTopic.findFirst({
    where: {
      id: topicId,
      OR: [
        { userId: null }, // It's a template topic
        { userId: userId }, // It's a user-created topic
      ],
    },
  });

  if (!topic) {
    throw new Error('Chat topic not found or access denied.');
  }

  // Return all messages for that topic
  return prisma.gsChatMessage.findMany({
    where: { topicId: topicId },
    orderBy: { createdAt: 'asc' },
  });
};

/**
 * --- REWRITTEN (Replaces postMessage) ---
 * Posts a new message and gets an AI response, based on the new schema.
 */
export const postNewMessage = async (userId, topicId, userMessage) => {
  // 1. Get the knowledge context for this topic
  const topic = await prisma.gsTopic.findFirst({
    where: {
      id: topicId,
      OR: [
        { userId: null }, // It's a template topic
        { userId: userId }, // It's a user-created topic
      ],
    },
    include: { content: true },
  });

  if (!topic) throw new Error('Topic not found or access denied');

  // Create context from all GsContentBlocks linked to this topic
  const context = topic.content.length > 0
    ? topic.content.map((c) => c.content).join('\n---\n')
    : 'No specific context provided for this topic. Answer based on general knowledge.';

  // 2. Get chat history
  const history = await prisma.gsChatMessage.findMany({
    where: { topicId: topicId },
    orderBy: { createdAt: 'asc' },
    take: 10, // Get last 10 messages for context
  });

  // 3. Create the AI prompt
  const systemMessage = `You are SarvaGyaan, an expert tutor for Indian competitive exams.
You are teaching the user about "${topic.name}".

Your rules are:
1.  For any question directly related to "${topic.name}", you MUST answer using ONLY the provided CONTEXT.
2.  If the answer to a topical question is not in the CONTEXT, you must say: "I'm sorry, that is outside my current knowledge for this topic."
3.  For general chat, small talk (like "Hii", "ok thanks"), or meta-questions, you can answer using your general knowledge.

CONTEXT:
${context}`;

  const messages = [
    { role: 'system', content: systemMessage },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })), // Map history
    { role: 'user', content: userMessage },
  ];

  // 4. Get AI response
  const aiResponse = await getChatCompletion(messages);

  // 5. Save messages to DB (in a transaction)
  await prisma.$transaction([
    prisma.gsChatMessage.create({
      data: {
        role: 'user',
        content: userMessage,
        topicId: topicId,
        // No sessionId!
      },
    }),
    prisma.gsChatMessage.create({
      data: {
        role: 'assistant',
        content: aiResponse,
        topicId: topicId,
        // No sessionId!
      },
    }),
  ]);

  return aiResponse;
};

// Mark a topic as learned
export const markTopicAsLearned = async (userId, topicId) => {
  // First, ensure the topic exists and the user has access
  const topic = await prisma.gsTopic.findFirst({
    where: {
      id: topicId,
      OR: [{ userId: null }, { userId: userId }],
    },
  });

  if (!topic) throw new Error('Topic not found');

  return prisma.gsLearningHistory.upsert({
    where: { userId_topicId: { userId, topicId } },
    update: { hasLearned: true },
    create: { userId, topicId, hasLearned: true },
  });
};

// Generate a revision question
export const getRevisionForUser = async (userId) => {
  const learnedTopics = await prisma.gsTopic.findMany({
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
      content: `You are SarvaGyaan, a revision tutor. The user wants to revise topics they have already learned.
Based on the following context, ask the user ONE concise question to test their knowledge.
CONTEXT:
${context}`,
    },
  ];

  const revisionQuestion = await getChatCompletion(messages);
  return revisionQuestion;
};

// This is your new function, it's correct.
export const createTopicFromContext = async (userId, context) => {
  // 1. Create a special prompt for the AI
  const initialPrompt = `
    A user was just reading a news article titled: "${context}"
    
    Your task is to respond in two parts, separated by "---":
    1.  First, on a single line, provide a short, concise topic name (3-5 words) for this article (e.g., "Quantum Computing" or "Indian Polity").
    2.  Second, after the "---" separator, write a friendly, simple explanation of this topic for a beginner, starting with a greeting.
  `;

  // 2. Call the AI service
  const messages = [{ role: 'system', content: initialPrompt }];
  const aiResponse = await getChatCompletion(messages);

  // 3. Parse the AI's response
  const responseParts = aiResponse.split('---', 2);
  let topicName;
  let initialMessage;

  if (responseParts.length === 2) {
    topicName = responseParts[0].trim();
    initialMessage = responseParts[1].trim();
  } else {
    // Fallback in case the AI doesn't follow instructions
    topicName = context.substring(0, 50); // Use the truncated title
    initialMessage = "Hello! Let's talk about that topic. What would you like to know first?";
  }

  // 4. Create the new GsTopic in the database
  const newTopic = await prisma.gsTopic.create({
    data: {
      name: topicName,
      userId: userId, // This is a user-specific, non-template topic
    },
  });

  // 5. Save the AI's first message to the new chat
  await prisma.gsChatMessage.create({
    data: {
      role: 'assistant',
      content: initialMessage,
      topicId: newTopic.id, // Link to the new topic
    },
  });

  // 6. Return the new topic object (the frontend needs the ID)
  return newTopic;
};