import { Router } from 'express';
import * as GsController from './gs.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

// Get all subjects and their topics for the UI
router.get('/subjects', GsController.getSubjects);

// Get chat history for a specific topic
router.get('/chat/:topicId', authenticateToken, GsController.getChat);

// Post a new message to the chat
router.post('/chat/:topicId', authenticateToken, GsController.postChat);

// Mark a topic as "learned"
router.post('/learn/:topicId', authenticateToken, GsController.markAsLearned);

// Get a revision prompt
router.get('/revise', authenticateToken, GsController.getRevision);

export default router;