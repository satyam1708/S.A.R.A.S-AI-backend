// src/modules/bookmarks/bookmarks.routes.js
import { Router } from "express";
import * as BookmarkController from "./bookmarks.controller.js";
import * as validators from "./bookmarks.validation.js"; // Import Schemas
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js"; // Import Middleware

const router = Router();

// Public routes
router.get("/public", BookmarkController.getPublicBookmarks);

// Protected routes
router.post(
  "/", 
  authMiddleware, 
  validate(validators.addBookmarkSchema), 
  BookmarkController.addBookmark
);

router.get(
  "/", 
  authMiddleware, 
  BookmarkController.getBookmarks
);

router.delete(
  "/", 
  authMiddleware, 
  validate(validators.deleteBookmarkSchema), 
  BookmarkController.deleteBookmark
);

export default router;