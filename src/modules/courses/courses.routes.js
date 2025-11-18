// src/modules/courses/courses.routes.js
import express from 'express';
import * as courseController from './courses.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js'; // Assuming you have these
import {adminMiddleware} from '../../middleware/admin.middleware.js';
const router = express.Router();

// Public: View available courses
router.get('/', courseController.listCourses);
router.get('/:id', courseController.getCourseDetails);

// Protected: Admin Only - Manage Courses
router.post('/', authMiddleware, adminMiddleware, courseController.createNewCourse);
router.post('/:id/subjects', authMiddleware, adminMiddleware, courseController.linkSubject);

// Protected: Admin Only - Manage Global Subjects
router.get('/subjects/all', authMiddleware, adminMiddleware, courseController.listSubjects);
router.post('/subjects', authMiddleware, adminMiddleware, courseController.createSubject);

export default router;