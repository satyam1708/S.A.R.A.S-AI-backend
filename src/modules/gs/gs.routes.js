import { Router } from 'express';
import {
  getSubjects,
  postMessage,
  streamMessage,
  getChatHistory, // Ensure this is imported
  markTopicAsLearned,
  getRevision,
  createChatFromContext,
  getQuizzesForTopic, // <-- [UPDATED]
  submitQuizForTopic,
  checkAnswer,        // <-- [NEW]
  getDueFlashcardsController,  // <-- 1. IMPORT NEW
  reviewFlashcardController,
  generateImage,
} from './gs.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const gsRouter = Router();

// --- Public Routes ---
gsRouter.get('/subjects', getSubjects);

// --- User Protected Routes ---

// 1. SPECIFIC routes must come BEFORE dynamic routes.
// This route creates a new topic from a news article's context
gsRouter.post('/chat/from-context', authMiddleware, createChatFromContext);

// 2. DYNAMIC routes come after.
gsRouter.get('/chat/:topicId', authMiddleware, getChatHistory);
gsRouter.post('/chat/:topicId', authMiddleware, postMessage);
gsRouter.post('/chat/stream/:topicId', authMiddleware, streamMessage);
gsRouter.post('/learn/:topicId', authMiddleware, markTopicAsLearned);
gsRouter.get('/revise', authMiddleware, getRevision);

// --- [NEW] Quiz Routes for Students ---
// --- [NEW] This route gets ALL quizzes for a topic
gsRouter.get('/quizzes/:topicId', authMiddleware, getQuizzesForTopic); // <-- [UPDATED]

// --- [NEW] This route checks a SINGLE answer for instant feedback
gsRouter.post('/quiz/check-answer', authMiddleware, checkAnswer);

// --- [NEW] This route submits the FINAL score
gsRouter.post('/quiz/submit/:quizId', authMiddleware, submitQuizForTopic);
gsRouter.get('/flashcards/due', authMiddleware, getDueFlashcardsController);
gsRouter.post('/flashcards/review', authMiddleware, reviewFlashcardController);
gsRouter.post('/chat/:topicId/image', authMiddleware, generateImage);


export default gsRouter;