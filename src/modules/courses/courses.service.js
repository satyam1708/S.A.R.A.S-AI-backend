// src/modules/courses/courses.service.js
import prisma from '../../lib/prisma.js';

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
  });
};

export const getCourseById = async (courseId) => {
  return await prisma.course.findUnique({
    where: { id: parseInt(courseId) },
    include: {
      subjects: {
        include: {
          subject: true, // Fetch the actual Subject name (e.g., "English")
        },
        orderBy: {
          orderIndex: 'asc',
        },
      },
    },
  });
};

// Link a Subject to a Course (e.g., Add "English" to "SSC CGL")
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

// Create a global Subject (if it doesn't exist)
export const createSubject = async (name) => {
  return await prisma.subject.create({
    data: { name },
  });
};

export const getAllSubjects = async () => {
  return await prisma.subject.findMany();
};