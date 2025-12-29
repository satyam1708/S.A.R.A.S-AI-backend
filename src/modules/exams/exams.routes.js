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

// 2. Get History (MOVED UP - Must be before /:id)
router.get('/my-results', authMiddleware, examController.getMyResults);

// 3. Get Exam Instructions/Details (Wildcard route comes last for GETs)
router.get('/:id', authMiddleware, examController.getExamDetails);

// 4. START EXAM
router.post('/start/:mockId', authMiddleware, examController.startExam);

// 5. SYNC HEARTBEAT
router.post('/attempt/:attemptId/sync', authMiddleware, examController.syncExamProgress);

// 6. SUBMIT EXAM
router.post('/attempt/:attemptId/submit', authMiddleware, examController.finishExam);


// ==========================================
// ADMIN ROUTES (Management)
// ==========================================

router.post('/generate/:courseId', authMiddleware, adminMiddleware, examController.generateMock);
router.post('/upload-pyq', authMiddleware, adminMiddleware, upload.single('file'), examController.uploadPYQ);

export default router;