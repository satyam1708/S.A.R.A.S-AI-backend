import { z } from 'zod';

export const startExamSchema = z.object({
  params: z.object({
    mockId: z.string().regex(/^\d+$/, "Mock ID must be a number"),
  }),
});

export const syncSchema = z.object({
  params: z.object({
    attemptId: z.string().regex(/^\d+$/, "Attempt ID must be a number"),
  }),
  body: z.object({
    timeTaken: z.number().nonnegative(),
    warningCount: z.number().int().nonnegative().optional(),
    answers: z.array(z.object({
      questionId: z.number(),
      selectedOption: z.number().nullable(),
      timeTaken: z.number().optional()
    })).optional()
  })
});

export const generateSchema = z.object({
  params: z.object({
    courseId: z.string().regex(/^\d+$/, "Course ID must be a number"),
  }),
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    useAI: z.boolean().optional(),
    examType: z.enum(["FULL_MOCK", "SECTIONAL"]).optional(),
    // UPDATED: Use coerce.number() to handle string inputs like "5" from frontend
    subjectId: z.coerce.number().nullable().optional()
  }).refine((data) => {
    // Custom Logic: If SECTIONAL, subjectId is required
    if (data.examType === "SECTIONAL" && !data.subjectId) return false;
    return true;
  }, {
    message: "Subject ID is required for Sectional Exams",
    path: ["subjectId"]
  })
});