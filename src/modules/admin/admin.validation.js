// src/modules/admin/admin.validation.js
import { z } from "zod";

// --- ID Validations ---
const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID must be a number"),
});

const subjectIdParamSchema = z.object({
  subjectId: z.string().regex(/^\d+$/, "Subject ID must be a number"),
});

const topicIdParamSchema = z.object({
  topicId: z.string().regex(/^\d+$/, "Topic ID must be a number"),
});

const blockIdParamSchema = z.object({
  blockId: z.string().regex(/^\d+$/, "Block ID must be a number"),
});

const quizIdParamSchema = z.object({
  quizId: z.string().regex(/^\d+$/, "Quiz ID must be a number"),
});

// --- Body Validations ---

export const createSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Subject name must be at least 2 characters"),
  }),
});

export const updateSubjectSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().min(2, "Subject name must be at least 2 characters"),
  }),
});

export const createChapterSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Chapter name must be at least 2 characters"),
    subjectId: z.number().int().positive("Subject ID is required"),
  }),
});

export const updateChapterSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().min(2, "Chapter name must be at least 2 characters"),
  }),
});

export const createTopicSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Topic name must be at least 2 characters"),
    subjectId: z.number().int().positive("Subject ID is required"),
    chapterId: z.number().int().positive().nullable().optional(),
  }),
});

export const updateTopicSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().min(2, "Topic name must be at least 2 characters"),
  }),
});

export const addContentSchema = z.object({
  body: z.object({
    topicId: z.number().int().positive("Topic ID is required"),
    content: z.string().min(10, "Content must be at least 10 characters"),
  }),
});

export const updateContentSchema = z.object({
  params: blockIdParamSchema,
  body: z.object({
    content: z.string().min(10, "Content must be at least 10 characters"),
  }),
});

// --- Export Param Schemas for simple routes ---
export const getByIdSchema = z.object({ params: idParamSchema });
export const getBySubjectIdSchema = z.object({ params: subjectIdParamSchema });
export const getByTopicIdSchema = z.object({ params: topicIdParamSchema });
export const deleteBlockSchema = z.object({ params: blockIdParamSchema });
export const deleteQuizSchema = z.object({ params: quizIdParamSchema });