import { Router } from 'express';
import { registerUser, loginUser, getProfile } from './auth.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js'; // We need to create this

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', authenticateToken, getProfile);

export default router;