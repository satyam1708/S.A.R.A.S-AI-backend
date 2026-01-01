import { z } from "zod";

// --- ID Parameter Validation ---
const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID must be a valid number"),
});

// --- Create Question Schema ---
export const createQuestionSchema = z.object({
  body: z.object({
    topicId: z.number().int().positive("Topic ID is required"),
    questionText: z.string().min(5, "Question text must be at least 5 characters"),
    options: z.array(z.string()).min(2, "At least 2 options are required"),
    correctIndex: z.number().int().min(0, "Correct index must be 0 or greater"),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional().default("MEDIUM"),
    explanation: z.string().optional(),
    
    // Optional: Link to Mock Test immediately
    mockTestId: z.number().int().positive().optional(),
    marks: z.number().positive().optional(),
    negative: z.number().nonnegative().optional(),
  }).refine(data => data.correctIndex < data.options.length, {
    message: "Correct index cannot be greater than the number of options",
    path: ["correctIndex"]
  }),
});

// --- Update Question Schema ---
export const updateQuestionSchema = z.object({
  params: idParamSchema,
  body: z.object({
    topicId: z.number().int().positive().optional(),
    questionText: z.string().min(5).optional(),
    options: z.array(z.string()).min(2).optional(),
    correctIndex: z.number().int().min(0).optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
    explanation: z.string().optional(),
  }),
});

// --- List/Filter Schema ---
export const listQuestionsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10"),
    search: z.string().optional(),
    topicId: z.string().regex(/^\d+$/).transform(Number).optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
    mockTestId: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});

// --- Delete Schema ---
export const deleteQuestionSchema = z.object({
  params: idParamSchema,
});

export const getQuestionSchema = z.object({
  params: idParamSchema,
});