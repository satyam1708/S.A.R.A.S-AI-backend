import { Router } from 'express';
import * as NewsController from './news.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/ping', NewsController.pingGNews); // /api/ping
router.get('/news', NewsController.getNews); // /api/news
router.get('/image-proxy', NewsController.proxyImage); // /api/image-proxy
router.post('/news/summarize', authenticateToken, NewsController.summarize); // /api/news/summarize

export default router;