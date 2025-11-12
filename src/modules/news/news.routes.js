// src/modules/news/news.routes.js
import { Router } from 'express';
import * as NewsController from './news.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

// These routes are now relative to /api/news
router.get('/ping', NewsController.pingGNews);
router.get('/headlines', NewsController.getHeadlines); // Was GET /
router.get('/search', NewsController.searchNews); 
router.get('/', NewsController.getNews); // Was '/news'
router.get('/image-proxy', NewsController.proxyImage);
router.post('/summarize', authMiddleware, NewsController.summarize); // Was '/news/summarize'
router.post('/radio', authMiddleware, NewsController.getRadioBroadcast);
router.post('/radio/chat', authMiddleware, NewsController.postRadioChat);

export default router;