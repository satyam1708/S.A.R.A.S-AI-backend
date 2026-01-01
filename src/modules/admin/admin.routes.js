// src/modules/admin/admin.routes.js
import { Router } from "express";
import * as AdminController from "./admin.controller.js";
import * as validators from "./admin.validation.js"; // Import Zod Schemas
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { adminMiddleware } from "../../middleware/admin.middleware.js";
import { validate } from "../../middleware/validate.middleware.js"; // Import Middleware
import { upload } from "../../middleware/upload.middleware.js";

const router = Router();

// Secure all admin routes
router.use(authMiddleware, adminMiddleware);

// --- Subject Routes ---
router.post(
  "/subjects", 
  validate(validators.createSubjectSchema), 
  AdminController.createSubject
);
router.get("/subjects", AdminController.getSubjects);
router.put(
  "/subjects/:id", 
  validate(validators.updateSubjectSchema), 
  AdminController.updateSubject
);
router.delete(
  "/subjects/:id", 
  validate(validators.getByIdSchema), 
  AdminController.deleteSubject
);

// --- Chapter Routes ---
router.post(
  "/chapters", 
  validate(validators.createChapterSchema), 
  AdminController.createChapter
);
router.get(
  "/chapters/:subjectId", 
  validate(validators.getBySubjectIdSchema), 
  AdminController.getChaptersBySubject
);
router.put(
  "/chapters/:id", 
  validate(validators.updateChapterSchema), 
  AdminController.updateChapter
);
router.delete(
  "/chapters/:id", 
  validate(validators.getByIdSchema), 
  AdminController.deleteChapter
);

// --- Topic Routes ---
router.post(
  "/topics", 
  validate(validators.createTopicSchema), 
  AdminController.createTopic
);
router.get(
  "/topics/:subjectId", 
  validate(validators.getBySubjectIdSchema), 
  AdminController.getTopicsBySubject
);
router.put(
  "/topics/:id", 
  validate(validators.updateTopicSchema), 
  AdminController.updateTopic
);
router.delete(
  "/topics/:id", 
  validate(validators.getByIdSchema), 
  AdminController.deleteTopic
);

// --- Content Routes ---
router.post(
  "/content", 
  validate(validators.addContentSchema), 
  AdminController.addContentBlock
);
router.get(
  "/content/:topicId", 
  validate(validators.getByTopicIdSchema), 
  AdminController.getContentForTopic
);
router.put(
  "/content/:blockId", 
  validate(validators.updateContentSchema), 
  AdminController.updateContentBlock
);
router.delete(
  "/content/:blockId", 
  validate(validators.deleteBlockSchema), 
  AdminController.deleteContentBlock
);

// Uploads (Validation for ID is mostly covered by logic, but ensuring :topicId is valid helps)
router.post(
  "/content/upload-book/:topicId", 
  validate(validators.getByTopicIdSchema),
  upload.single("book"), 
  AdminController.uploadBookContent
);

// --- Quiz Routes ---
router.post(
  "/quiz/generate/:topicId", 
  validate(validators.getByTopicIdSchema), 
  AdminController.generateQuizForTopic
);
router.get(
  "/quizzes/:topicId", 
  validate(validators.getByTopicIdSchema), 
  AdminController.getQuizzesForTopic
);
router.delete(
  "/quiz/:quizId", 
  validate(validators.deleteQuizSchema), 
  AdminController.deleteQuiz
);

export default router;