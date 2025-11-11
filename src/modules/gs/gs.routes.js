import { Router } from 'express';
import {
  getSubjects,
  postMessage,
  streamMessage,
  getChatHistory, // Ensure this is imported
  markTopicAsLearned,
  getRevision,
  createChatFromContext,
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

export default gsRouter;