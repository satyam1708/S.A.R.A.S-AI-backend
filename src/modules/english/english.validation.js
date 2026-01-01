// src/modules/english/english.validation.js
import { z } from 'zod';

export const getDoseByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Dose ID must be a number"),
  }),
});

export const getDoseByDateSchema = z.object({
  query: z.object({
    // Strictly validate YYYY-MM-DD to avoid timezone parsing ambiguity
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  }),
});