// src/modules/news/news.validation.js
import { z } from 'zod';

export const getHeadlinesSchema = z.object({
  query: z.object({
    category: z.string().optional().default("general"),
    language: z.string().length(2).optional().default("en"), // 'en', 'hi'
  }),
});

export const searchNewsSchema = z.object({
  query: z.object({
    keyword: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
    language: z.string().length(2).optional().default("en"),
    country: z.string().length(2).optional().default("in"),
    sortBy: z.enum(["publishedAt", "relevance"]).optional().default("publishedAt"),
  }),
});

export const summarizeSchema = z.object({
  body: z.object({
    content: z.string().min(50, "Article content is too short to summarize"),
  }),
});

export const radioBroadcastSchema = z.object({
  body: z.object({
    category: z.string().optional().default("general"),
    language: z.enum(["en-US", "hi-IN"]).optional().default("en-US"),
  }),
});

export const radioChatSchema = z.object({
  body: z.object({
    userMessage: z.string().min(1, "Message is required"),
    broadcastScript: z.string().min(10, "Broadcast script context is required"),
    chatHistory: z.array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    ).optional(),
    language: z.enum(["en-US", "hi-IN"]).optional().default("en-US"),
  }),
});