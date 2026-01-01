import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const selectCourseSchema = z.object({
  body: z.object({
    // Accepts string "1" or number 1, ensures it's a valid ID
    courseId: z.union([z.string(), z.number()])
      .refine((val) => !isNaN(parseInt(val)), "Course ID must be a number"),
  }),
});