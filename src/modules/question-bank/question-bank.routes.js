import express from 'express';
import * as questionController from './question-bank.controller.js';
import * as validators from './question-bank.validation.js'; // Import Schemas
import { validate } from '../../middleware/validate.middleware.js'; // Import Middleware
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { adminMiddleware } from '../../middleware/admin.middleware.js';

const router = express.Router();

// All routes require Admin access
router.use(authMiddleware, adminMiddleware);

router.get(
  '/', 
  validate(validators.listQuestionsSchema), 
  questionController.listQuestions
);

router.post(
  '/', 
  validate(validators.createQuestionSchema), 
  questionController.createQuestion
);

router.get(
  '/:id', 
  validate(validators.getQuestionSchema), 
  questionController.getQuestion
);

router.patch(
  '/:id', 
  validate(validators.updateQuestionSchema), 
  questionController.updateQuestion
);

router.delete(
  '/:id', 
  validate(validators.deleteQuestionSchema), 
  questionController.deleteQuestion
);

export default router;