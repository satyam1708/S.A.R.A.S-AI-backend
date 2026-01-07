// src/modules/gs/gs.routes.js
import { Router } from 'express';
import * as GsController from './gs.controller.js';
import * as validators from './gs.validation.js'; // Import Schemas
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js'; // Import Middleware

const gsRouter = Router();

// --- Public Routes ---
gsRouter.get('/subjects', GsController.getSubjects);

// --- User Protected Routes ---

// 1. SPECIFIC routes must come BEFORE dynamic routes.
gsRouter.post(
  '/chat/from-context', 
  authMiddleware, 
  validate(validators.contextSchema), // Validate Context
  GsController.createChatFromContext
);

// 2. DYNAMIC routes come after.
gsRouter.get(
  '/chat/:topicId', 
  authMiddleware, 
  validate(validators.getTopicSchema),
  GsController.getChatHistory
);

gsRouter.post(
  '/chat/:topicId', 
  authMiddleware, 
  validate(validators.chatMessageSchema), // Validate Message & Topic
  GsController.postMessage
);

gsRouter.post(
  '/chat/stream/:topicId', 
  authMiddleware, 
  validate(validators.chatMessageSchema), // Validate Message & Topic
  GsController.streamMessage
);

gsRouter.post(
  '/learn/:topicId', 
  authMiddleware, 
  validate(validators.getTopicSchema),
  GsController.markTopicAsLearned
);

gsRouter.get('/revise', authMiddleware, GsController.getRevision);

// --- Quiz Routes ---
gsRouter.get(
  '/quizzes/:topicId', 
  authMiddleware, 
  validate(validators.getTopicSchema),
  GsController.getQuizzesForTopic
);

gsRouter.post(
  '/quiz/check-answer', 
  authMiddleware, 
  validate(validators.checkAnswerSchema),
  GsController.checkAnswer
);

gsRouter.post(
  '/quiz/submit/:quizId', 
  authMiddleware, 
  validate(validators.submitQuizSchema),
  GsController.submitQuizForTopic
);

// --- Flashcard Routes ---
gsRouter.get('/flashcards/due', authMiddleware, GsController.getDueFlashcardsController);

gsRouter.post(
  '/flashcards/review', 
  authMiddleware, 
  validate(validators.reviewFlashcardSchema),
  GsController.reviewFlashcardController
);

// --- Image Gen ---
gsRouter.post(
  '/chat/:topicId/image', 
  authMiddleware, 
  validate(validators.imageGenSchema),
  GsController.generateImage
);
gsRouter.get('/knowledge-graph', authMiddleware, GsController.getKnowledgeGraph);
export default gsRouter;