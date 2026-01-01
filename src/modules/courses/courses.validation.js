// src/modules/courses/courses.validation.js
import { z } from 'zod';

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Course ID must be a number")
});

const subjectIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Course ID must be a number"),
  subjectId: z.string().regex(/^\d+$/, "Subject ID must be a number")
});

export const createCourseSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Course name must be at least 3 characters"),
    description: z.string().optional(),
  }),
});

export const updateCourseSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().min(3).optional(),
    description: z.string().optional(),
  }),
});

export const createGlobalSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Subject name must be at least 2 characters"),
  }),
});

export const linkSubjectSchema = z.object({
  params: idParamSchema,
  body: z.object({
    subjectId: z.number().int().positive("Subject ID is required"),
    questionCount: z.number().int().min(1, "Must have at least 1 question"),
    marksPerQ: z.number().positive("Marks must be positive"),
    negativeMarks: z.number().nonnegative().default(0),
    orderIndex: z.number().int().optional(),
    difficultyConfig: z.object({
      EASY: z.number().min(0).max(100),
      MEDIUM: z.number().min(0).max(100),
      HARD: z.number().min(0).max(100),
    }).optional(),
  }),
});

export const getByIdSchema = z.object({ params: idParamSchema });
export const unlinkSubjectSchema = z.object({ params: subjectIdParamSchema });