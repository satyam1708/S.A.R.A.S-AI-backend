import express from 'express';
import * as examController from './exams.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { adminMiddleware } from '../../middleware/admin.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

// --- ZOD SCHEMAS ---
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({ body: req.body, query: req.query, params: req.params });
    next();
  } catch (e) {
    return res.status(400).json({ error: e.errors });
  }
};

const startExamSchema = z.object({
  params: z.object({
    mockId: z.string().regex(/^\d+$/, "Mock ID must be a number"),
  }),
});

const syncSchema = z.object({
  params: z.object({
    attemptId: z.string().regex(/^\d+$/, "Attempt ID must be a number"),
  }),
  body: z.object({
    timeTaken: z.number().nonnegative(),
    answers: z.array(z.object({
      questionId: z.number(),
      selectedOption: z.number().nullable(),
      timeTaken: z.number().optional()
    })).optional()
  })
});

const generateSchema = z.object({
  params: z.object({
    courseId: z.string().regex(/^\d+$/, "Course ID must be a number"),
  }),
  body: z.object({
    title: z.string().min(3),
    useAI: z.boolean().optional(),
    examType: z.enum(["FULL_MOCK", "SECTIONAL"]).optional(),
    subjectId: z.number().nullable().optional()
  })
});

// --- RATE LIMITERS ---
const genLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 generations per 15 min
  message: "Too many exams generated, please try again later."
});

const router = express.Router();

// ==========================================
// STUDENT ROUTES
// ==========================================

router.get('/', authMiddleware, examController.listMocks);
router.get('/my-results', authMiddleware, examController.getMyResults);
router.get('/:id', authMiddleware, examController.getExamDetails);

router.post(
  '/start/:mockId', 
  authMiddleware, 
  validate(startExamSchema), 
  examController.startExam
);

router.post(
  '/attempt/:attemptId/sync', 
  authMiddleware, 
  validate(syncSchema), 
  examController.syncExamProgress
);

router.post(
  '/attempt/:attemptId/submit', 
  authMiddleware, 
  validate(syncSchema), 
  examController.finishExam
);

// ==========================================
// ADMIN ROUTES
// ==========================================

router.post(
  '/generate/:courseId', 
  authMiddleware, 
  adminMiddleware, 
  genLimiter, // Rate Limit Applied
  validate(generateSchema), 
  examController.generateMock
);

router.post(
  '/upload-pyq', 
  authMiddleware, 
  adminMiddleware, 
  upload.single('file'), 
  examController.uploadPYQ
);

export default router;