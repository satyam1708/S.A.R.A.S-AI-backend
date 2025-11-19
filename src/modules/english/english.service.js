import prisma from "../../lib/prisma.js";
import { generateEnglishDose } from "../../services/aiService.js";

export const getDailyDose = async (dateObj) => {
  // 1. Normalize date to YYYY-MM-DD (ignore time)
  const today = new Date(dateObj);
  today.setHours(0, 0, 0, 0);

  // 2. Check DB
  let dose = await prisma.englishDose.findUnique({
    where: { date: today }
  });

  // 3. If missing, generate via AI (Lazy Generation)
  if (!dose) {
    console.log(`[English] Generating dose for ${today.toISOString()}...`);
    const content = await generateEnglishDose();
    
    dose = await prisma.englishDose.create({
      data: {
        date: today,
        content
      }
    });
  }

  return dose;
};

export const getHistory = async () => {
  return prisma.englishDose.findMany({
    orderBy: { date: 'desc' },
    select: { id: true, date: true } // Light payload
  });
};

export const getDoseById = async (id) => {
  return prisma.englishDose.findUnique({ where: { id: parseInt(id) } });
};