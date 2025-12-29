import express from 'express';
import * as examController from './exams.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { adminMiddleware } from '../../middleware/admin.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';

const router = express.Router();

// ==========================================
// STUDENT ROUTES (Exam Taking Flow)
// ==========================================

// 1. List available mocks
router.get('/', authMiddleware, examController.listMocks);

// 2. Get Exam Instructions/Details
router.get('/:id', authMiddleware, examController.getExamDetails);

// 3. START EXAM (New - Creates the 'IN_PROGRESS' attempt)
router.post('/start/:mockId', authMiddleware, examController.startExam);

// 4. SYNC HEARTBEAT (New - Saves answers periodically during exam)
router.post('/attempt/:attemptId/sync', authMiddleware, examController.syncExamProgress);

// 5. SUBMIT EXAM (Updated - Finalizes the attempt)
router.post('/attempt/:attemptId/submit', authMiddleware, examController.finishExam);

// 6. Get History
router.get('/history/my-results', authMiddleware, examController.getMyResults);


// ==========================================
// ADMIN ROUTES (Management)
// ==========================================

router.post('/generate/:courseId', authMiddleware, adminMiddleware, examController.generateMock);
router.post('/upload-pyq', authMiddleware, adminMiddleware, upload.single('file'), examController.uploadPYQ);

export default router;