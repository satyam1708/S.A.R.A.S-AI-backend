// src/modules/courses/courses.routes.js
import express from 'express';
import * as courseController from './courses.controller.js';
import { authenticateUser, authorizeAdmin } from '../../middleware/auth.middleware.js'; // Assuming you have these

const router = express.Router();

// Public: View available courses
router.get('/', courseController.listCourses);
router.get('/:id', courseController.getCourseDetails);

// Protected: Admin Only - Manage Courses
router.post('/', authenticateUser, authorizeAdmin, courseController.createNewCourse);
router.post('/:id/subjects', authenticateUser, authorizeAdmin, courseController.linkSubject);

// Protected: Admin Only - Manage Global Subjects
router.get('/subjects/all', authenticateUser, authorizeAdmin, courseController.listSubjects);
router.post('/subjects', authenticateUser, authorizeAdmin, courseController.createSubject);

export default router;