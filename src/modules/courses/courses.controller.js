// src/modules/courses/courses.controller.js
import * as courseService from './courses.service.js';

// ... (Keep existing listCourses, getCourseDetails, createNewCourse) ...
export const listCourses = async (req, res) => {
  try {
    const courses = await courseService.getAllCourses();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCourseDetails = async (req, res) => {
  try {
    const course = await courseService.getCourseById(req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createNewCourse = async (req, res) => {
  try {
    const course = await courseService.createCourse(req.body);
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- NEW FUNCTIONS ---

export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await courseService.updateCourse(id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    await courseService.deleteCourse(id);
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const unlinkSubject = async (req, res) => {
  try {
    const { id: courseId, subjectId } = req.params;
    await courseService.removeSubjectFromCourse(courseId, subjectId);
    res.json({ message: 'Subject unlinked successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ... (Keep existing linkSubject, createSubject, listSubjects) ...
export const linkSubject = async (req, res) => {
  try {
    const { id: courseId } = req.params; 
    const { subjectId, questionCount, marksPerQ, negativeMarks, orderIndex } = req.body;
    const link = await courseService.addSubjectToCourse(courseId, subjectId, {
      questionCount,
      marksPerQ,
      negativeMarks,
      orderIndex
    });
    res.status(201).json(link);
  } catch (error) {
    console.error("Link Subject Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createSubject = async (req, res) => {
  try {
    const subject = await courseService.createSubject(req.body.name);
    res.status(201).json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listSubjects = async (req, res) => {
  try {
    const subjects = await courseService.getAllSubjects();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};