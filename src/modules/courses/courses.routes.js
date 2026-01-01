import express from 'express';
import * as courseController from './courses.controller.js';
import * as validators from './courses.validation.js'; // Import schemas
import { authMiddleware } from '../../middleware/auth.middleware.js'; 
import { adminMiddleware } from '../../middleware/admin.middleware.js';
import { validate } from '../../middleware/validate.middleware.js'; // Import Middleware

const router = express.Router();

// Public: View available courses
router.get('/', courseController.listCourses);
router.get(
  '/:id', 
  validate(validators.getByIdSchema), 
  courseController.getCourseDetails
);

// Protected: Admin Only - Manage Courses
router.post(
  '/', 
  authMiddleware, 
  adminMiddleware, 
  validate(validators.createCourseSchema), 
  courseController.createNewCourse
);

router.put(
  '/:id', 
  authMiddleware, 
  adminMiddleware, 
  validate(validators.updateCourseSchema), 
  courseController.updateCourse
);

router.delete(
  '/:id', 
  authMiddleware, 
  adminMiddleware, 
  validate(validators.getByIdSchema), 
  courseController.deleteCourse
);

// Manage Course Subjects
router.post(
  '/:id/subjects', 
  authMiddleware, 
  adminMiddleware, 
  validate(validators.linkSubjectSchema), 
  courseController.linkSubject
);

router.delete(
  '/:id/subjects/:subjectId', 
  authMiddleware, 
  adminMiddleware, 
  validate(validators.unlinkSubjectSchema), 
  courseController.unlinkSubject
);

// Protected: Admin Only - Manage Global Subjects
router.get(
  '/subjects/all', 
  authMiddleware, 
  adminMiddleware, 
  courseController.listSubjects
);

router.post(
  '/subjects', 
  authMiddleware, 
  adminMiddleware, 
  validate(validators.createGlobalSubjectSchema), 
  courseController.createSubject
);

export default router;