import express from 'express';
import * as questionController from './question-bank.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { adminMiddleware } from '../../middleware/admin.middleware.js';

const router = express.Router();

// Apply Auth & Admin Check to ALL routes in this file
router.use(authMiddleware, adminMiddleware);

// 1. Search/List Questions (for Admin Dashboard)
router.get('/', questionController.listQuestions);

// 2. Get Single Question details
router.get('/:id', questionController.getQuestion);

// 3. Edit Question (Fix Content)
router.patch('/:id', questionController.updateQuestion);

// 4. Delete Question
router.delete('/:id', questionController.deleteQuestion);

export default router;