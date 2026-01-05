import { Router } from 'express';
import * as authController from './auth.controller.js';
import * as validators from './auth.validation.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

// Public Routes
router.post(
  '/register', 
  validate(validators.registerSchema), 
  authController.registerUser
);

router.post(
  '/login', 
  validate(validators.loginSchema), 
  authController.loginUser
);

// Protected Routes
router.get(
  '/profile', 
  authMiddleware, 
  authController.getProfile
);

router.put(
  '/select-course', 
  authMiddleware, 
  validate(validators.selectCourseSchema), 
  authController.selectCourse
);
router.post('/refresh-token', authController.refreshToken);

export default router;