// src/modules/bookmarks/bookmarks.routes.js
import { Router } from 'express';
import * as BookmarkController from './bookmarks.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

// These routes are now relative to /api/bookmarks
router.post('/', authenticateToken, BookmarkController.addBookmark);
router.get('/', authenticateToken, BookmarkController.getBookmarks);
router.delete('/', authenticateToken, BookmarkController.deleteBookmark);

export default router;