import express from 'express';
import * as questionController from './question-bank.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { adminMiddleware } from '../../middleware/admin.middleware.js';

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get('/', questionController.listQuestions);
router.post('/', questionController.createQuestion); // NEW: Create Route
router.get('/:id', questionController.getQuestion);
router.patch('/:id', questionController.updateQuestion);
router.delete('/:id', questionController.deleteQuestion);

export default router;