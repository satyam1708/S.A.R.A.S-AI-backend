// src/modules/english/english.routes.js
import { Router } from 'express';
import * as EnglishController from './english.controller.js';
import * as validators from './english.validation.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

// Get Today's Dose (Auto-generated if missing)
router.get('/today', EnglishController.getTodayDose);

// Get Specific Date (e.g. ?date=2023-10-25)
router.get(
  '/date', 
  validate(validators.getDoseByDateSchema), 
  EnglishController.getDoseByDate
);

// Get History List
router.get('/history', EnglishController.getHistory);

// Get Specific Dose by ID
router.get(
  '/:id', 
  validate(validators.getDoseByIdSchema), 
  EnglishController.getDoseById
);

export default router;