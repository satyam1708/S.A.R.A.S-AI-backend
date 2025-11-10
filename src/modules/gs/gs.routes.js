import { Router } from 'express';
import {
  getSubjects,
  postMessage,           // This now matches the controller
  getChatHistory,        // This now matches the controller
  markTopicAsLearned,
  getRevision,
  createChatFromContext,
} from './gs.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
// Removed unused adminMiddleware import

const gsRouter = Router();

// --- Public Routes ---
gsRouter.get('/subjects', getSubjects);

// --- User Protected Routes ---
gsRouter.get('/chat/:topicId', authMiddleware, getChatHistory);
gsRouter.post('/chat/:topicId', authMiddleware, postMessage);
gsRouter.post('/learn/:topicId', authMiddleware, markTopicAsLearned);
gsRouter.get('/revise', authMiddleware, getRevision);

// This route will create a new topic from a news article's context
gsRouter.post('/chat/from-context', authMiddleware, createChatFromContext);

// --- Admin Routes ---
// (No changes to admin routes)

export default gsRouter;