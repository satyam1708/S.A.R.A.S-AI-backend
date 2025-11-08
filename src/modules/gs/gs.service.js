import prisma from '../../lib/prisma.js';
import { getChatCompletion } from '../../services/aiService.js';

// Get all subjects and their nested topics for the UI
export const getSubjectsAndTopics = async () => {
  return prisma.subject.findMany({
    include: {
      topics: {
        select: { id: true, name: true }
      }
    }
  });
};

// Find or create a chat session for a user and topic
export const getChatSession = async (userId, topicId) => {
  let session = await prisma.chatSession.findUnique({
    where: { userId_topicId: { userId, topicId } }, // Assumes @@unique([userId, topicId]) on ChatSession
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });

  if (!session) {
    session = await prisma.chatSession.create({
      data: { userId, topicId },
      include: { messages: true }
    });
  }
  return session;
};

// Post a new message and get an AI response
export const postMessage = async (userId, topicId, userMessage) => {
  const session = await getChatSession(userId, topicId);

  // 1. Get the knowledge context for this topic
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { content: true }
  });

  if (!topic) throw new Error('Topic not found');
  const context = topic.content.map(c => c.content).join('\n---\n');

  // 2. Get chat history
  const history = session.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  // 3. Create the AI prompt
  const systemMessage = `You are SarvaGyaan, an expert tutor for Indian competitive exams.
You are teaching the user about "${topic.name}".
You MUST answer questions using ONLY the following context.
If the answer is not in the context, say "I'm sorry, that is outside my current knowledge for this topic."

CONTEXT:
${context}`;

  const messages = [
    { role: 'system', content: systemMessage },
    ...history,
    { role: 'user', content: userMessage }
  ];

  // 4. Get AI response
  const aiResponse = await getChatCompletion(messages);

  // 5. Save messages to DB (in a transaction)
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'user', content: userMessage }
    }),
    prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: aiResponse }
    })
  ]);

  return aiResponse;
};

// Mark a topic as learned
export const markTopicAsLearned = async (userId, topicId) => {
  return prisma.learningHistory.upsert({
    where: { userId_topicId: { userId, topicId } },
    update: {},
    create: { userId, topicId }
  });
};

// Generate a revision question
export const getRevisionForUser = async (userId) => {
  const learnedTopics = await prisma.topic.findMany({
    where: { learnedBy: { some: { userId } } },
    include: { content: true }
  });

  if (learnedTopics.length === 0) {
    return "You haven't marked any topics as 'learned' yet. Once you do, I can help you revise them!";
  }

  const context = learnedTopics
    .map(topic => `Topic: ${topic.name}\n${topic.content.map(c => c.content).join('\n')}`)
    .join('\n---\n');

  const messages = [
    {
      role: 'system',
      content: `You are SarvaGyaan, a revision tutor. The user wants to revise topics they have already learned.
Based on the following context, ask the user ONE concise question to test their knowledge.
CONTEXT:
${context}`
    }
  ];

  const revisionQuestion = await getChatCompletion(messages);
  return revisionQuestion;
};