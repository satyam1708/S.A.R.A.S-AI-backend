//src/modules/courses/courses.service.js
import prisma from '../../lib/prisma.js';

// --- CORE COURSE MANAGEMENT ---

export const createCourse = async (data) => {
  return await prisma.course.create({
    data: {
      name: data.name,
      description: data.description,
    },
  });
};

export const getAllCourses = async () => {
  return await prisma.course.findMany({
    include: {
      _count: {
        select: { subjects: true, mockTests: true },
      },
    },
    orderBy: { id: 'asc' }
  });
};

export const getCourseById = async (courseId) => {
  return await prisma.course.findUnique({
    where: { id: parseInt(courseId) },
    include: {
      subjects: {
        include: {
          subject: { include: { _count: { select: { topics: true } } } }, 
        },
        orderBy: {
          orderIndex: 'asc',
        },
      },
    },
  });
};

export const updateCourse = async (id, data) => {
  return await prisma.course.update({
    where: { id: parseInt(id) },
    data: {
      name: data.name,
      description: data.description
    }
  });
};

export const deleteCourse = async (id) => {
  return await prisma.course.delete({
    where: { id: parseInt(id) }
  });
};

// --- SYLLABUS & EXAM PATTERN ENGINE ---

export const addSubjectToCourse = async (courseId, subjectId, config) => {
  // --- FIX: USE UPSERT TO PREVENT UNIQUE CONSTRAINT ERRORS ---
  return await prisma.courseSubject.upsert({
    where: {
      courseId_subjectId: {
        courseId: parseInt(courseId),
        subjectId: parseInt(subjectId)
      }
    },
    update: {
      questionCount: parseInt(config.questionCount),
      marksPerQ: parseFloat(config.marksPerQ),
      negativeMarks: parseFloat(config.negativeMarks),
      orderIndex: parseInt(config.orderIndex || 1),
      difficultyConfig: config.difficultyConfig || { EASY: 30, MEDIUM: 50, HARD: 20 }
    },
    create: {
      courseId: parseInt(courseId),
      subjectId: parseInt(subjectId),
      questionCount: parseInt(config.questionCount),
      marksPerQ: parseFloat(config.marksPerQ),
      negativeMarks: parseFloat(config.negativeMarks),
      orderIndex: parseInt(config.orderIndex || 1),
      difficultyConfig: config.difficultyConfig || { EASY: 30, MEDIUM: 50, HARD: 20 }
    },
  });
};

/**
 * Updates the specific exam pattern for a subject in a course
 */
export const updateCourseSubjectConfig = async (courseId, subjectId, config) => {
  return await prisma.courseSubject.update({
    where: {
      courseId_subjectId: {
        courseId: parseInt(courseId),
        subjectId: parseInt(subjectId)
      }
    },
    data: {
      questionCount: config.questionCount ? parseInt(config.questionCount) : undefined,
      marksPerQ: config.marksPerQ ? parseFloat(config.marksPerQ) : undefined,
      negativeMarks: config.negativeMarks !== undefined ? parseFloat(config.negativeMarks) : undefined,
      orderIndex: config.orderIndex ? parseInt(config.orderIndex) : undefined,
      difficultyConfig: config.difficultyConfig || undefined
    }
  });
};

export const removeSubjectFromCourse = async (courseId, subjectId) => {
  return await prisma.courseSubject.delete({
    where: {
      courseId_subjectId: {
        courseId: parseInt(courseId),
        subjectId: parseInt(subjectId)
      }
    }
  });
};

// --- GLOBAL SUBJECTS ---

export const createSubject = async (name) => {
  return await prisma.subject.create({
    data: { name },
  });
};

export const getAllSubjects = async () => {
  return await prisma.subject.findMany({ 
    include: { _count: { select: { topics: true } } },
    orderBy: { name: 'asc' } 
  });
};