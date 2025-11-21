import { Router } from 'express';
import * as NewsController from './news.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

// Public Routes
router.get('/ping', NewsController.pingGNews);
router.get('/headlines', NewsController.getHeadlines);
router.get('/search', NewsController.searchNews); 
router.get('/', NewsController.getNews); 
router.get('/image-proxy', NewsController.proxyImage);

// Protected Routes
router.post('/summarize', authMiddleware, NewsController.summarize);
router.post('/radio', authMiddleware, NewsController.getRadioBroadcast);

// Standard Chat (Non-Streaming)
router.post('/radio/chat', authMiddleware, NewsController.postRadioChat);

// --- NEW STREAMING ROUTE ---
// This route handles the low-latency voice chat connection
router.post('/radio/chat/stream', authMiddleware, NewsController.postRadioChatStream);

export default router;