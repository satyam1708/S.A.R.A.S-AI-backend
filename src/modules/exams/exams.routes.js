import express from 'express';
import * as examController from './exams.controller.js';
import { authenticateUser, authorizeAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Student Routes
router.get('/', authenticateUser, examController.listMocks);
router.post('/submit', authenticateUser, examController.submitExam);

// Admin Routes (Generation & Upload)
router.post('/generate/:courseId', authenticateUser, authorizeAdmin, examController.generateMock);
router.post('/upload-pyq', authenticateUser, authorizeAdmin, examController.uploadPYQ);

export default router;