import { Router } from 'express';
import { registerUser, loginUser, getProfile, selectCourse } from './auth.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js'; // We need to create this

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', authMiddleware, getProfile);
router.put('/select-course', authMiddleware, selectCourse);

export default router;