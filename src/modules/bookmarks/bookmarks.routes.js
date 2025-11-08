import { Router } from 'express';
import * as BookmarkController from './bookmarks.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes are protected and prefixed with /api/bookmarks
router.post('/bookmarks', authenticateToken, BookmarkController.addBookmark);
router.get('/bookmarks', authenticateToken, BookmarkController.getBookmarks);
router.delete('/bookmarks', authenticateToken, BookmarkController.deleteBookmark);

export default router;