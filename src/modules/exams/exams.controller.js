import * as examService from './exams.service.js';
import { PDFExtract } from 'pdf.js-extract';
import * as mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// --- STUDENT: EXAM FLOW ---

export const startExam = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mockId } = req.params;
    
    // Validation
    if (!mockId || isNaN(parseInt(mockId))) {
        return res.status(400).json({ error: "Invalid Mock ID provided." });
    }

    const attempt = await examService.startExamSession(userId, mockId);
    res.status(201).json(attempt);
  } catch (error) {
    console.error("Start Exam Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const syncExamProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;
    const { answers, timeTaken, warningCount } = req.body;

    if (!attemptId || isNaN(parseInt(attemptId))) {
        return res.status(400).json({ error: "Invalid Attempt ID." });
    }

    const result = await examService.saveHeartbeat(
      parseInt(attemptId), 
      userId, 
      answers, 
      timeTaken, 
      warningCount
    );
    
    res.json({ success: true, savedAt: result.lastHeartbeat });
  } catch (error) {
    console.error("Heartbeat Error:", error);
    res.status(500).json({ error: "Failed to sync progress" });
  }
};

export const finishExam = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;
    const { answers, timeTaken, warningCount } = req.body;

    if (!attemptId || isNaN(parseInt(attemptId))) {
        return res.status(400).json({ error: "Invalid Attempt ID." });
    }

    const result = await examService.finalizeExam(
      parseInt(attemptId),
      userId,
      answers,
      timeTaken,
      warningCount
    );

    res.json(result);
  } catch (error) {
    console.error("Submit Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// --- EXISTING METHODS ---

export const generateMock = async (req, res) => {
  try {
    const { courseId } = req.params;
    // Extract everything needed for generation
    const { title, useAI, examType, subjectId } = req.body; 
    
    const mock = await examService.generateMockExam(
        courseId, 
        title, 
        useAI, 
        examType, 
        subjectId
    );
    res.status(201).json(mock);
  } catch (error) {
    console.error("Generation Error:", error);
    res.status(500).json({ error: "Failed to generate exam: " + error.message });
  }
};

export const listMocks = async (req, res) => {
  try {
    const { courseId } = req.query;
    if (!courseId) return res.json([]); // Return empty if no course selected
    
    const tests = await examService.getMockTestsForCourse(courseId);
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Deprecated: Old submit endpoint 
export const submitExam = async (req, res) => {
    res.status(410).json({ error: "Please use the new /start and /submit flow." });
};

export const uploadPYQ = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded." });

  const { courseId, year, source } = req.body;
  let fullText = '';
  let tempFilePath = '';

  try {
    if (file.mimetype === 'application/pdf') {
      tempFilePath = path.join(os.tmpdir(), `pyq_${Date.now()}.pdf`);
      await fs.writeFile(tempFilePath, file.buffer);
      const pdfExtract = new PDFExtract();
      const data = await pdfExtract.extract(tempFilePath);
      fullText = data.pages.map(p => p.content.map(i => i.str).join(' ')).join('\n');
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const { value } = await mammoth.default.extractRawText({ buffer: file.buffer });
      fullText = value;
    } else if (file.mimetype === 'text/plain') {
      fullText = file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: "Unsupported file type." });
    }

    const cleanText = fullText.replace(/\n\n+/g, '\n');
    const result = await examService.processPreviousYearPaper(cleanText, courseId, year, source);
    res.json(result);
  } catch (error) {
    console.error("PYQ Upload Error:", error);
    res.status(500).json({ error: "Failed to process file." });
  } finally {
    if (tempFilePath) try { await fs.unlink(tempFilePath); } catch (e) {}
  }
};

export const getExamDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    // --- FIX: HANDLE UNDEFINED/INVALID ID ---
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
        return res.status(400).json({ error: "Invalid Exam ID provided" });
    }

    const exam = await examService.getMockTestById(parsedId);
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    
    res.json(exam);
  } catch (error) {
    console.error("Get Exam Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getMyResults = async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await examService.getUserExamHistory(userId);
    res.json(history);
  } catch (error) {
    console.error("Fetch Results Error:", error);
    res.status(500).json({ error: "Failed to fetch exam history" });
  }
};