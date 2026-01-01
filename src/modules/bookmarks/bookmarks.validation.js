// src/modules/bookmarks/bookmarks.validation.js
import { z } from "zod";

export const addBookmarkSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    url: z.string().url("Invalid URL format"),
    description: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    publishedAt: z.string().datetime().optional().nullable().or(z.string()), // Accept ISO strings
    source: z.string().optional().nullable(),
  }),
});

export const deleteBookmarkSchema = z.object({
  body: z.object({
    url: z.string().url("Invalid URL format for deletion"),
  }),
});