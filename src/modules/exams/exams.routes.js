import express from 'express';
import * as examController from './exams.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import {adminMiddleware} from '../../middleware/admin.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';

const router = express.Router();

// Student Routes
router.get('/', authMiddleware, examController.listMocks);
router.get('/:id', authMiddleware, examController.getExamDetails);
router.post('/submit', authMiddleware, examController.submitExam);

// Admin Routes (Generation & Upload)
router.post('/generate/:courseId', authMiddleware, adminMiddleware, examController.generateMock);
router.post('/upload-pyq', authMiddleware, adminMiddleware,upload.single('file'), examController.uploadPYQ);

export default router;