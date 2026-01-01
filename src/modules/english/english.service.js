// src/modules/english/english.service.js
import prisma from "../../lib/prisma.js";
import { generateEnglishDose } from "../../services/aiService.js";
import logger from "../../lib/logger.js";

/**
 * Normalizes a Date object or string to a UTC Date object at 00:00:00.
 * This is crucial for matching Prisma's @db.Date type consistently.
 */
const normalizeToUtcDate = (inputDate) => {
  const d = new Date(inputDate);
  // Create date using UTC components to ensure 00:00:00 UTC
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

export const getDailyDose = async (dateInput = new Date()) => {
  const targetDate = normalizeToUtcDate(dateInput);
  const today = normalizeToUtcDate(new Date());

  // 1. Try to find existing dose
  let dose = await prisma.englishDose.findUnique({
    where: { date: targetDate }
  });

  // 2. If found, return it
  if (dose) return dose;

  // 3. If NOT found:
  // We only auto-generate if the requested date is "Today" (or future/very recent).
  // We generally don't want to auto-generate history for 2020 on the fly.
  if (targetDate.getTime() === today.getTime()) {
    logger.info(`[English] Cache miss for today (${targetDate.toISOString()}). Generating...`);
    
    try {
      const content = await generateEnglishDose();

      // 4. UPSERT (Critical for Concurrency)
      // If 50 users hit this line at once, DB handles the lock.
      // One creates, others update (no-op), and all get the result.
      dose = await prisma.englishDose.upsert({
        where: { date: targetDate },
        update: {}, // Do nothing if exists
        create: {
          date: targetDate,
          content
        }
      });
      return dose;
    } catch (error) {
      logger.error(`[English] AI Generation Failed: ${error.message}`);
      // Fallback: Return the most recent dose we have instead of crashing
      const latest = await prisma.englishDose.findFirst({ orderBy: { date: 'desc' } });
      if (latest) return { ...latest, isFallback: true };
      throw error;
    }
  }

  // If requesting a past date that doesn't exist, return null (404)
  return null;
};

export const getHistory = async () => {
  return prisma.englishDose.findMany({
    orderBy: { date: 'desc' },
    take: 30, // Last 30 days
    select: { 
      id: true, 
      date: true,
      // We don't send full content list to save bandwidth
    } 
  });
};

export const getDoseById = async (id) => {
  return prisma.englishDose.findUnique({ 
    where: { id: parseInt(id) } 
  });
};