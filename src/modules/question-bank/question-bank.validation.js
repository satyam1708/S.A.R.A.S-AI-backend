import { z } from 'zod';

// --- Utility: Convert "" to undefined ---
const emptyString = (val) => (val === "" ? undefined : val);

// --- Reusable ---
const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Question ID must be a number"),
});

// --- Schemas ---

export const listQuestionsSchema = z.object({
  query: z.object({
    // Preprocess handles the "?page=1" strings from URL
    page: z.preprocess(
      (val) => parseInt(val, 10), 
      z.number().int().min(1).default(1)
    ),
    limit: z.preprocess(
      (val) => parseInt(val, 10), 
      z.number().int().min(1).max(100).default(10)
    ),
    
    // Preprocess handles "?search=" (empty string)
    search: z.preprocess(emptyString, z.string().optional()),
    
    topicId: z.preprocess(emptyString, z.string().regex(/^\d+$/).optional()),
    
    difficulty: z.preprocess(
      emptyString, 
      z.enum(['EASY', 'MEDIUM', 'HARD']).optional()
    ),
    
    mockTestId: z.preprocess(emptyString, z.string().regex(/^\d+$/).optional()),
  }),
});

export const createQuestionSchema = z.object({
  body: z.object({
    topicId: z.number().int().positive("Topic ID is required"),
    questionText: z.string().min(5, "Question text must be at least 5 characters"),
    options: z.array(z.string()).min(2, "At least 2 options are required"),
    correctIndex: z.number().int().nonnegative("Correct index must be 0 or greater"),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
    explanation: z.string().optional(),
    
    // Optional Link
    mockTestId: z.number().int().positive().optional(),
    marks: z.number().positive().optional(),
    negative: z.number().nonnegative().optional(),
  }).refine((data) => data.correctIndex < data.options.length, {
    message: "Correct Index cannot be greater than the number of options",
    path: ["correctIndex"],
  }),
});

export const getQuestionSchema = z.object({
  params: idParamSchema,
});

export const updateQuestionSchema = z.object({
  params: idParamSchema,
  body: z.object({
    topicId: z.number().int().positive().optional(),
    questionText: z.string().min(5).optional(),
    options: z.array(z.string()).min(2).optional(),
    correctIndex: z.number().int().nonnegative().optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    explanation: z.string().optional(),
  }),
});

export const deleteQuestionSchema = z.object({
  params: idParamSchema,
});