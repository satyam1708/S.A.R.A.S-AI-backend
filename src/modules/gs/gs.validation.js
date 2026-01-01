// src/modules/gs/gs.validation.js
import { z } from 'zod';

// --- Reusable Params ---
const topicIdParam = z.object({
  topicId: z.string().regex(/^\d+$/, "Topic ID must be a number"),
});

const quizIdParam = z.object({
  quizId: z.string().regex(/^\d+$/, "Quiz ID must be a number"),
});

// --- Route Schemas ---

export const getTopicSchema = z.object({
  params: topicIdParam,
});

export const chatMessageSchema = z.object({
  params: topicIdParam,
  body: z.object({
    message: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
  }),
});

export const contextSchema = z.object({
  body: z.object({
    context: z.string().min(10, "Context must be at least 10 characters long"),
  }),
});

export const checkAnswerSchema = z.object({
  body: z.object({
    questionId: z.number().int().positive(),
    selectedAnswerIndex: z.number().int().nonnegative(),
  }),
});

export const submitQuizSchema = z.object({
  params: quizIdParam,
  body: z.object({
    answers: z.array(
      z.object({
        questionId: z.number().int().positive(),
        selectedAnswerIndex: z.number().int().nonnegative(),
      })
    ).min(1, "At least one answer is required"),
  }),
});

export const reviewFlashcardSchema = z.object({
  body: z.object({
    flashcardId: z.number().int().positive(),
    rating: z.number().int().min(0).max(2, "Rating must be 0 (Again), 1 (Good), or 2 (Easy)"),
  }),
});

export const imageGenSchema = z.object({
  params: topicIdParam,
  body: z.object({
    prompt: z.string().min(5, "Prompt must be descriptive (min 5 chars)"),
  }),
});