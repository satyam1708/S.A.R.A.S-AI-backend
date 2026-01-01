import * as courseService from './courses.service.js';
import logger from '../../lib/logger.js';

// --- COURSE CRUD ---

export const listCourses = async (req, res) => {
  try {
    const courses = await courseService.getAllCourses();
    res.json(courses);
  } catch (error) {
    logger.error(`List Courses Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const getCourseDetails = async (req, res) => {
  try {
    const course = await courseService.getCourseById(req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  } catch (error) {
    logger.error(`Get Course Details Failed [ID:${req.params.id}]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const createNewCourse = async (req, res) => {
  try {
    const course = await courseService.createCourse(req.body);
    logger.info(`Course Created: ${course.name}`);
    res.status(201).json(course);
  } catch (error) {
    logger.error(`Create Course Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await courseService.updateCourse(id, req.body);
    logger.info(`Course Updated: ${id}`);
    res.json(updated);
  } catch (error) {
    logger.error(`Update Course Failed [ID:${req.params.id}]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    await courseService.deleteCourse(id);
    logger.info(`Course Deleted: ${id}`);
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    logger.error(`Delete Course Failed [ID:${req.params.id}]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

// --- SYLLABUS & EXAM PATTERN MANAGEMENT ---

export const listSubjects = async (req, res) => {
  try {
    const subjects = await courseService.getAllSubjects();
    res.json(subjects);
  } catch (error) {
    logger.error(`List Subjects Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const createSubject = async (req, res) => {
  try {
    const subject = await courseService.createSubject(req.body.name);
    logger.info(`Subject Created: ${subject.name}`);
    res.status(201).json(subject);
  } catch (error) {
    logger.error(`Create Subject Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const linkSubject = async (req, res) => {
  try {
    const { id: courseId } = req.params; 
    const { subjectId, questionCount, marksPerQ, negativeMarks, orderIndex, difficultyConfig } = req.body;
    
    const link = await courseService.addSubjectToCourse(courseId, subjectId, {
      questionCount,
      marksPerQ,
      negativeMarks,
      orderIndex,
      difficultyConfig
    });
    
    logger.info(`Subject ${subjectId} linked to Course ${courseId}`);
    res.status(201).json(link);
  } catch (error) {
    logger.error(`Link Subject Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const unlinkSubject = async (req, res) => {
  try {
    const { id: courseId, subjectId } = req.params;
    await courseService.removeSubjectFromCourse(courseId, subjectId);
    logger.info(`Subject ${subjectId} unlinked from Course ${courseId}`);
    res.json({ message: 'Subject unlinked successfully' });
  } catch (error) {
    logger.error(`Unlink Subject Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};