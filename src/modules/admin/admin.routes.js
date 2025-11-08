// src/modules/admin/admin.routes.js
import { Router } from 'express';
import * as AdminController from './admin.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { adminOnly } from '../../middleware/admin.middleware.js';

const router = Router();

// All admin routes are protected by auth and admin role
router.use(authenticateToken, adminOnly);

// Subject routes
router.post('/subjects', AdminController.createSubject);
router.get('/subjects', AdminController.getSubjects);

// Topic routes
router.post('/topics', AdminController.createTopic); // expects { name, subjectId }
router.get('/topics/:subjectId', AdminController.getTopicsBySubject);

// Content routes
router.post('/content', AdminController.addContentBlock); // expects { topicId, content }
router.get('/content/:topicId', AdminController.getContentForTopic);
router.delete('/content/:blockId', AdminController.deleteContentBlock);

export default router;