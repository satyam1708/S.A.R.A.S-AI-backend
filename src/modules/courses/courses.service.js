// src/modules/courses/courses.service.js
import prisma from '../../lib/prisma.js';

// ... (Keep existing createCourse, getAllCourses, getCourseById) ...
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
          subject: true, 
        },
        orderBy: {
          orderIndex: 'asc',
        },
      },
    },
  });
};

// --- NEW FUNCTIONS ---

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

export const removeSubjectFromCourse = async (courseId, subjectId) => {
  // Because CourseSubject has a composite unique key, we can use delete
  return await prisma.courseSubject.delete({
    where: {
      courseId_subjectId: {
        courseId: parseInt(courseId),
        subjectId: parseInt(subjectId)
      }
    }
  });
};

// ... (Keep existing addSubjectToCourse, createSubject, getAllSubjects) ...
export const addSubjectToCourse = async (courseId, subjectId, config) => {
  return await prisma.courseSubject.create({
    data: {
      courseId: parseInt(courseId),
      subjectId: parseInt(subjectId),
      questionCount: config.questionCount,
      marksPerQ: config.marksPerQ,
      negativeMarks: config.negativeMarks,
      orderIndex: config.orderIndex,
    },
  });
};

export const createSubject = async (name) => {
  return await prisma.subject.create({
    data: { name },
  });
};

export const getAllSubjects = async () => {
  return await prisma.subject.findMany({ orderBy: { name: 'asc' } });
};