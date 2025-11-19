// src/modules/admin/admin.routes.js
import { Router } from "express";
import * as AdminController from "./admin.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { adminMiddleware } from "../../middleware/admin.middleware.js";
import { upload } from "../../middleware/upload.middleware.js";

const router = Router();

router.use(authMiddleware, adminMiddleware);

// Subject routes
router.post("/subjects", AdminController.createSubject);
router.get("/subjects", AdminController.getSubjects);
router.put("/subjects/:id", AdminController.updateSubject); // <-- NEW
router.delete("/subjects/:id", AdminController.deleteSubject); // <-- NEW

router.post("/chapters", AdminController.createChapter);
router.get("/chapters/:subjectId", AdminController.getChaptersBySubject);
router.put("/chapters/:id", AdminController.updateChapter);
router.delete("/chapters/:id", AdminController.deleteChapter);

// Topic routes
router.post("/topics", AdminController.createTopic);
router.get("/topics/:subjectId", AdminController.getTopicsBySubject);
router.put("/topics/:id", AdminController.updateTopic); // <-- NEW
router.delete("/topics/:id", AdminController.deleteTopic); // <-- NEW

// Content routes
router.post("/content", AdminController.addContentBlock); 
router.get("/content/:topicId", AdminController.getContentForTopic);
router.put("/content/:blockId", AdminController.updateContentBlock); // <-- NEW
router.delete("/content/:blockId", AdminController.deleteContentBlock);
router.post("/content/upload-book/:topicId", upload.single("book"), AdminController.uploadBookContent);

// Quiz Routes
router.post("/quiz/generate/:topicId", AdminController.generateQuizForTopic);
router.get("/quizzes/:topicId", AdminController.getQuizzesForTopic);
router.delete("/quiz/:quizId", AdminController.deleteQuiz);

export default router;