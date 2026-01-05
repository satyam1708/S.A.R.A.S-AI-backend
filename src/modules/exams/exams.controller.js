import * as examService from "./exams.service.js";
import { PDFExtract } from "pdf.js-extract";
import * as mammoth from "mammoth";
import fs from "fs/promises";
import path from "path";
import os from "os";
import logger from "../../lib/logger.js"; // Assuming you create this (Winston)

// --- STUDENT FLOW ---

export const startExam = async (req, res) => {
  // Input already validated by Zod Middleware
  const userId = req.user.id;
  const { mockId } = req.params;

  try {
    const attempt = await examService.startExamSession(userId, mockId);
    res.status(201).json(attempt);
  } catch (error) {
    logger.error(`Start Exam Failed [User:${userId}]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const syncExamProgress = async (req, res) => {
  const userId = req.user.id;
  const { attemptId } = req.params;
  const { answers, timeTaken, warningCount } = req.body;

  try {
    const result = await examService.saveHeartbeat(
      parseInt(attemptId),
      userId,
      answers,
      timeTaken,
      warningCount
    );
    res.json({ success: true, savedAt: result.lastHeartbeat });
  } catch (error) {
    logger.error(`Heartbeat Failed [Attempt:${attemptId}]: ${error.message}`);
    res.status(500).json({ error: "Failed to sync progress" });
  }
};

export const finishExam = async (req, res) => {
  const userId = req.user.id;
  const { attemptId } = req.params;
  const { answers, timeTaken, warningCount } = req.body;

  try {
    const result = await examService.finalizeExam(
      parseInt(attemptId),
      userId,
      answers,
      timeTaken,
      warningCount
    );
    res.json(result);
  } catch (error) {
    logger.error(`Submit Exam Failed [Attempt:${attemptId}]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

// --- ADMIN / MANAGEMENT ---

export const generateMock = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, useAI, examType, subjectId } = req.body;

    // This can take 30-60 seconds, so usually we might want to return 202 here too,
    // but for generation, users often expect to wait.
    const mock = await examService.generateMockExam(
      courseId,
      title,
      useAI,
      examType,
      subjectId
    );
    res.status(201).json(mock);
  } catch (error) {
    logger.error(`Mock Gen Failed: ${error.message}`);
    res.status(500).json({ error: "Failed to generate exam." });
  }
};

/**
 * [UPDATED] Non-Blocking File Upload (In-Memory Processing)
 * Solves "serverless crash" by avoiding writing to disk.
 */
export const uploadPYQ = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded." });

  const { courseId, year, source } = req.body;

  // 1. Respond Immediately
  res.status(202).json({
    message: "File accepted. Processing started in background.",
    status: "PROCESSING",
  });

  // 2. Process in Background (In-Memory)
  setImmediate(async () => {
    try {
      logger.info(`Starting in-memory PYQ processing for Course ${courseId}`);
      let fullText = "";

      if (file.mimetype === "application/pdf") {
        // FIX: Parse buffer directly, no fs.writeFile needed!
        const data = await pdfParse(file.buffer);
        fullText = data.text;
      } else if (
        file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const { value } = await mammoth.extractRawText({ buffer: file.buffer });
        fullText = value;
      } else {
        fullText = file.buffer.toString("utf-8");
      }

      const cleanText = fullText.replace(/\n\n+/g, "\n");

      // Call Service
      await examService.processPreviousYearPaper(
        cleanText,
        courseId,
        year,
        source
      );

      logger.info(`Background PYQ processing completed for Course ${courseId}`);

    } catch (error) {
      logger.error(`Background PYQ Failed: ${error.message}`);
    }
  });
};

export const listMocks = async (req, res) => {
  const { courseId } = req.query;
  const tests = await examService.getMockTestsForCourse(courseId);
  res.json(tests);
};

export const getExamDetails = async (req, res) => {
  const { id } = req.params; // Validated by Zod
  const exam = await examService.getMockTestById(id);
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  res.json(exam);
};

export const getMyResults = async (req, res) => {
  const userId = req.user.id;
  const history = await examService.getUserExamHistory(userId);
  res.json(history);
};
