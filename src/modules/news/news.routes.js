// src/modules/news/news.routes.js
import { Router } from 'express';
import * as NewsController from './news.controller.js';
import * as validators from './news.validation.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

// --- Public Routes ---
router.get('/ping', NewsController.pingGNews);

router.get(
  '/headlines', 
  validate(validators.getHeadlinesSchema), 
  NewsController.getHeadlines
);

router.get(
  '/search', 
  validate(validators.searchNewsSchema), 
  NewsController.searchNews
); 

// Legacy route (optional to keep)
router.get('/', NewsController.getNews); 

router.get('/image-proxy', NewsController.proxyImage);

// --- Protected Routes ---
router.post(
  '/summarize', 
  authMiddleware, 
  validate(validators.summarizeSchema), 
  NewsController.summarize
);

router.post(
  '/radio', 
  authMiddleware, 
  validate(validators.radioBroadcastSchema), 
  NewsController.getRadioBroadcast
);

// Standard Chat
router.post(
  '/radio/chat', 
  authMiddleware, 
  validate(validators.radioChatSchema), 
  NewsController.postRadioChat
);

// Streaming Chat
router.post(
  '/radio/chat/stream', 
  authMiddleware, 
  validate(validators.radioChatSchema), 
  NewsController.postRadioChatStream
);

export default router;