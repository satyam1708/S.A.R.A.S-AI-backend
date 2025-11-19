import { Router } from 'express';
import * as EnglishController from './english.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/today', authMiddleware, EnglishController.getTodayDose);
router.get('/history', authMiddleware, EnglishController.getHistory);
router.get('/:id', authMiddleware, EnglishController.getDoseById);

export default router;