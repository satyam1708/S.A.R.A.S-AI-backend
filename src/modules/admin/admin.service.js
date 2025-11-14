// src/modules/admin/admin.service.js
import prisma from '../../lib/prisma.js';
import { generateQuizFromContent, chunkContentForLearning,generateFlashcardsFromContent,getEmbedding } from '../../services/aiService.js';
import { toSql } from 'pgvector/pg';
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
export const addContent = async (topicId, content) => {
  // 1. Get embedding first
  const vector = await getEmbedding(content);

  // 2. Create the block with the vector
  return prisma.contentBlock.create({ 
    data: { 
      topicId, 
      content,
      // Use the toSql helper to format the vector for Prisma
      vector: toSql(vector) 
    } 
  });
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

  generateFlashcardsFromContent(context)
    .then(async (flashcards) => {
      if (flashcards && flashcards.length > 0) {
        const flashcardData = flashcards.map(fc => ({
          topicId: topicId,
          question: fc.question,
          answer: fc.answer,
        }));
        
        // Save all new flashcards
        await prisma.flashcard.createMany({
          data: flashcardData,
          skipDuplicates: true, // Avoid re-creating identical Q&A pairs
        });
        console.log(`[Admin] Successfully generated ${flashcards.length} flashcards for topic ${topicId}`);
      }
    })
    .catch(err => {
      console.error(`[Admin] Failed to generate flashcards for topic ${topicId}: ${err.message}`);
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
  // 1. Read the text from the file buffer (you already have this)
  const fullText = fileBuffer.toString('utf-8');
  if (!fullText.trim()) {
    throw new Error('Uploaded file is empty.');
  }

  // 2. Call AI service to chunk the content (you already have this)
  const contentChunks = await chunkContentForLearning(fullText);

  if (!contentChunks || contentChunks.length === 0) {
    throw new Error('AI failed to process the document into blocks.');
  }

  // 3. --- THIS IS THE NEW LOGIC ---
  // Instead of createMany, we loop and create one-by-one to get embeddings
  let createdCount = 0;
  for (const chunk of contentChunks) {
    try {
      // 3a. Get embedding for the chunk
      const vector = await getEmbedding(chunk);
      
      // 3b. Create the block with its vector
      await prisma.contentBlock.create({
        data: {
          content: chunk,
          topicId: topicId,
          vector: toSql(vector)
        }
      });
      createdCount++;
    } catch (err) {
      console.error(`Failed to create block for chunk: ${chunk.substring(0, 20)}...`, err);
    }
  }

  // 4. Return the number of blocks successfully created
  return createdCount;
};