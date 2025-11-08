// src/modules/news/news.routes.js
import { Router } from 'express';
import * as NewsController from './news.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

// These routes are now relative to /api/news
router.get('/ping', NewsController.pingGNews);
router.get('/', NewsController.getNews); // Was '/news'
router.get('/image-proxy', NewsController.proxyImage);
router.post('/summarize', authenticateToken, NewsController.summarize); // Was '/news/summarize'

export default router;