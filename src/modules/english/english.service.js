// src/modules/english/english.service.js
import prisma from "../../lib/prisma.js";
import { generateEnglishDose } from "../../services/aiService.js";
import logger from "../../lib/logger.js";

/**
 * Normalizes a date object to UTC Midnight (00:00:00.000Z).
 * This ensures "today" is always the same database key regardless of execution time.
 */
const normalizeDate = (dateInput) => {
  const d = new Date(dateInput);
  // Set to UTC Midnight to match Prisma's @db.Date behavior usually
  // Or simply strip time components in local time if you prefer local days.
  // For Enterprise consistency, we strictly use YYYY-MM-DD string conversion.
  const dateString = d.toISOString().split('T')[0]; 
  return new Date(dateString); // Returns Date object at 00:00:00 UTC
};

export const getDailyDose = async (dateObj) => {
  const targetDate = normalizeDate(dateObj);

  // 1. Check DB first (Fast Path)
  let dose = await prisma.englishDose.findUnique({
    where: { date: targetDate }
  });

  if (dose) return dose;

  // 2. If missing, Generate via AI (Slow Path)
  logger.info(`[English] Generating fresh dose for ${targetDate.toISOString().split('T')[0]}...`);
  
  try {
    const content = await generateEnglishDose();

    // 3. Save with UPSERT to handle Race Conditions
    // If 2 requests hit this line simultaneously, one will create, the other will update (or do nothing).
    // This prevents "Unique Constraint" crashes.
    dose = await prisma.englishDose.upsert({
      where: { date: targetDate },
      update: {}, // If exists, do nothing (return it)
      create: {
        date: targetDate,
        content
      }
    });

    return dose;
  } catch (error) {
    logger.error(`[English] Generation Failed: ${error.message}`);
    // Fallback: Return the most recent dose instead of crashing
    const latest = await prisma.englishDose.findFirst({ orderBy: { date: 'desc' } });
    if (latest) return { ...latest, isFallback: true };
    throw error;
  }
};

export const getHistory = async () => {
  return prisma.englishDose.findMany({
    orderBy: { date: 'desc' },
    take: 30, // Limit to last 30 days for performance
    select: { 
      id: true, 
      date: true,
      // Optional: Select a preview snippet if content structure allows
      // content: true 
    } 
  });
};

export const getDoseById = async (id) => {
  return prisma.englishDose.findUnique({ 
    where: { id: parseInt(id) } 
  });
};