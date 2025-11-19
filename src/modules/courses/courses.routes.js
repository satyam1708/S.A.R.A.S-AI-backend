// src/modules/courses/courses.routes.js
import express from 'express';
import * as courseController from './courses.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js'; 
import {adminMiddleware} from '../../middleware/admin.middleware.js';
const router = express.Router();

// Public: View available courses
router.get('/', courseController.listCourses);
router.get('/:id', courseController.getCourseDetails);

// Protected: Admin Only - Manage Courses
router.post('/', authMiddleware, adminMiddleware, courseController.createNewCourse);
router.put('/:id', authMiddleware, adminMiddleware, courseController.updateCourse); // <-- NEW
router.delete('/:id', authMiddleware, adminMiddleware, courseController.deleteCourse); // <-- NEW

// Manage Course Subjects
router.post('/:id/subjects', authMiddleware, adminMiddleware, courseController.linkSubject);
router.delete('/:id/subjects/:subjectId', authMiddleware, adminMiddleware, courseController.unlinkSubject); // <-- NEW

// Protected: Admin Only - Manage Global Subjects
router.get('/subjects/all', authMiddleware, adminMiddleware, courseController.listSubjects);
router.post('/subjects', authMiddleware, adminMiddleware, courseController.createSubject);

export default router;