import express from "express";
import * as examController from "./exams.controller.js";
import * as validators from "./exams.validation.js"; // Import schemas
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { adminMiddleware } from "../../middleware/admin.middleware.js";
import { upload } from "../../middleware/upload.middleware.js";
import { validate } from "../../middleware/validate.middleware.js"; // Import global middleware
import rateLimit from "express-rate-limit";

const router = express.Router();

// --- RATE LIMITERS ---
const genLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many exams generated, please try again later.",
});

// ==========================================
// STUDENT ROUTES
// ==========================================

router.get("/", authMiddleware, examController.listMocks);
router.get("/my-results", authMiddleware, examController.getMyResults);
router.get("/:id", authMiddleware, examController.getExamDetails);

router.post(
  "/start/:mockId",
  authMiddleware,
  validate(validators.startExamSchema),
  examController.startExam
);

router.post(
  "/attempt/:attemptId/sync",
  authMiddleware,
  validate(validators.syncSchema),
  examController.syncExamProgress
);

router.post(
  "/attempt/:attemptId/submit",
  authMiddleware,
  validate(validators.syncSchema),
  examController.finishExam
);

// ==========================================
// ADMIN ROUTES
// ==========================================

router.post(
  "/generate/:courseId",
  authMiddleware,
  adminMiddleware,
  genLimiter,
  validate(validators.generateSchema),
  examController.generateMock
);

router.post(
  "/upload-pyq",
  authMiddleware,
  adminMiddleware,
  upload.single("file"),
  examController.uploadPYQ
);

export default router;
