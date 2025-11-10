// src/modules/bookmarks/bookmarks.routes.js
import { Router } from 'express';
import * as BookmarkController from './bookmarks.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

// These routes are now relative to /api/bookmarks
router.post('/', authMiddleware, BookmarkController.addBookmark);
router.get('/', authMiddleware, BookmarkController.getBookmarks);
router.delete('/', authMiddleware, BookmarkController.deleteBookmark);

export default router;