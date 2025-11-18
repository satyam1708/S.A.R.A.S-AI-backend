import express from 'express';
import * as examController from './exams.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import {adminMiddleware} from '../../middleware/admin.middleware.js';

const router = express.Router();

// Student Routes
router.get('/', authMiddleware, examController.listMocks);
router.post('/submit', authMiddleware, examController.submitExam);

// Admin Routes (Generation & Upload)
router.post('/generate/:courseId', authMiddleware, adminMiddleware, examController.generateMock);
router.post('/upload-pyq', authMiddleware, adminMiddleware, examController.uploadPYQ);

export default router;