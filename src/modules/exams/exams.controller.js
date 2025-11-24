import * as examService from './exams.service.js';
import { PDFExtract } from 'pdf.js-extract';
import * as mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const generateMock = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title } = req.body;
    const mock = await examService.generateMockExam(courseId, title);
    res.status(201).json(mock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate exam" });
  }
};

export const listMocks = async (req, res) => {
  try {
    const { courseId } = req.query;
    const tests = await examService.getMockTestsForCourse(courseId);
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const submitExam = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mockTestId, answers } = req.body;
    const result = await examService.submitMockAttempt(userId, mockTestId, answers);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const uploadPYQ = async (req, res) => {
  const file = req.file;
  
  // 1. Validation
  if (!file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const { courseId, year, source } = req.body;
  let fullText = '';
  let tempFilePath = '';

  try {
    // 2. Handle different file types (Business Grade Robustness)
    if (file.mimetype === 'application/pdf') {
      // Create temp file for PDF extractor
      tempFilePath = path.join(os.tmpdir(), `pyq_${Date.now()}.pdf`);
      await fs.writeFile(tempFilePath, file.buffer);

      const pdfExtract = new PDFExtract();
      const data = await pdfExtract.extract(tempFilePath);
      
      // Join pages into a single text block
      fullText = data.pages
        .map(page => page.content.map(item => item.str).join(' '))
        .join('\n');

    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Handle .docx files
      const { value } = await mammoth.default.extractRawText({ buffer: file.buffer });
      fullText = value;
    } else if (file.mimetype === 'text/plain') {
      // Handle .txt files
      fullText = file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: "Unsupported file type. Please upload PDF, DOCX, or TXT." });
    }

    // 3. Clean up text (remove excessive newlines)
    const cleanText = fullText.replace(/\n\n+/g, '\n');

    // 4. Pass to Service for AI Processing
    const result = await examService.processPreviousYearPaper(cleanText, courseId, year, source);
    
    res.json(result);

  } catch (error) {
    console.error("PYQ Upload Error:", error);
    res.status(500).json({ error: "Failed to process file. " + error.message });
  } finally {
    // 5. Clean up temp file to prevent server storage bloat
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        console.error("Temp file cleanup failed:", e);
      }
    }
  }
};

export const getExamDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await examService.getMockTestById(id);
    
    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }
    
    res.json(exam);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};