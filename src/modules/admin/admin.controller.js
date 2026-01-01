// src/modules/admin/admin.controller.js
import * as AdminService from "./admin.service.js";
import { PDFExtract } from "pdf.js-extract";
import * as mammoth from "mammoth";
import fs from "fs/promises";
import path from "path";
import os from "os";
import logger from "../../lib/logger.js"; // Enterprise Logger

// --- Subjects ---
export const createSubject = async (req, res) => {
  try {
    const subject = await AdminService.createSubject(req.body.name);
    logger.info(`Subject created: ${subject.name} [ID: ${subject.id}]`);
    res.status(201).json(subject);
  } catch (error) {
    logger.error(`Create Subject Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const getSubjects = async (req, res) => {
  try {
    const subjects = await AdminService.getAllSubjects();
    res.json(subjects);
  } catch (error) {
    logger.error(`Get Subjects Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const updateSubject = async (req, res) => {
  try {
    const subject = await AdminService.updateSubject(
      parseInt(req.params.id),
      req.body.name
    );
    res.json(subject);
  } catch (error) {
    logger.error(`Update Subject Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const deleteSubject = async (req, res) => {
  try {
    await AdminService.deleteSubject(parseInt(req.params.id));
    logger.info(`Subject deleted: ${req.params.id}`);
    res.json({ message: "Subject deleted" });
  } catch (error) {
    logger.error(`Delete Subject Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// --- Chapters ---
export const createChapter = async (req, res) => {
  try {
    const { name, subjectId } = req.body;
    const chapter = await AdminService.createChapter(name, parseInt(subjectId));
    res.status(201).json(chapter);
  } catch (error) {
    logger.error(`Create Chapter Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const getChaptersBySubject = async (req, res) => {
  try {
    const chapters = await AdminService.getChapters(
      parseInt(req.params.subjectId)
    );
    res.json(chapters);
  } catch (error) {
    logger.error(`Get Chapters Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const updateChapter = async (req, res) => {
  try {
    const chapter = await AdminService.updateChapter(
      parseInt(req.params.id),
      req.body.name
    );
    res.json(chapter);
  } catch (error) {
    logger.error(`Update Chapter Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const deleteChapter = async (req, res) => {
  try {
    await AdminService.deleteChapter(parseInt(req.params.id));
    res.json({ message: "Chapter deleted" });
  } catch (error) {
    logger.error(`Delete Chapter Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// --- Topics ---
export const createTopic = async (req, res) => {
  try {
    const { name, subjectId, chapterId } = req.body;
    const topic = await AdminService.createTopic(
      name,
      parseInt(subjectId),
      chapterId ? parseInt(chapterId) : null
    );
    res.status(201).json(topic);
  } catch (error) {
    logger.error(`Create Topic Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const getTopicsBySubject = async (req, res) => {
  try {
    const topics = await AdminService.getTopics(parseInt(req.params.subjectId));
    res.json(topics);
  } catch (error) {
    logger.error(`Get Topics Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const updateTopic = async (req, res) => {
  try {
    const topic = await AdminService.updateTopic(
      parseInt(req.params.id),
      req.body.name
    );
    res.json(topic);
  } catch (error) {
    logger.error(`Update Topic Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const deleteTopic = async (req, res) => {
  try {
    await AdminService.deleteTopic(parseInt(req.params.id));
    res.json({ message: "Topic deleted" });
  } catch (error) {
    logger.error(`Delete Topic Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// --- Content Blocks ---
export const addContentBlock = async (req, res) => {
  try {
    const { topicId, content } = req.body;
    const block = await AdminService.addContent(parseInt(topicId), content);
    res.status(201).json(block);
  } catch (error) {
    logger.error(`Add Content Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const updateContentBlock = async (req, res) => {
  try {
    const { content } = req.body;
    const block = await AdminService.updateContent(
      parseInt(req.params.blockId),
      content
    );
    res.json(block);
  } catch (error) {
    logger.error(`Update Content Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const getContentForTopic = async (req, res) => {
  try {
    const blocks = await AdminService.getContent(parseInt(req.params.topicId));
    res.json(blocks);
  } catch (error) {
    logger.error(`Get Content Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const deleteContentBlock = async (req, res) => {
  try {
    await AdminService.deleteContent(parseInt(req.params.blockId));
    res.status(200).json({ message: "Content block deleted" });
  } catch (error) {
    logger.error(`Delete Content Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// --- Quizzes ---
export const generateQuizForTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const quiz = await AdminService.generateQuiz(parseInt(topicId));
    res.status(201).json(quiz);
  } catch (error) {
    logger.error(`Generate Quiz Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const getQuizzesForTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const quizzes = await AdminService.getQuizzesForTopic(parseInt(topicId));
    res.json(quizzes);
  } catch (error) {
    logger.error(`Get Quizzes Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    await AdminService.deleteQuiz(parseInt(quizId));
    res.status(200).json({ message: "Quiz deleted" });
  } catch (error) {
    logger.error(`Delete Quiz Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// --- File Upload (Non-Blocking) ---
export const uploadBookContent = async (req, res) => {
  const { topicId } = req.params;
  const file = req.file;

  if (!file) return res.status(400).json({ message: "No file was uploaded." });

  // 1. Respond Immediately
  res.status(202).json({
    message: "File accepted. Content processing started in background.",
    status: "PROCESSING",
  });

  // 2. Process in Background
  setImmediate(async () => {
    let tempFilePath = "";
    try {
      logger.info(`Starting background book upload for Topic ${topicId}`);
      let fullText = "";

      if (file.mimetype === "application/pdf") {
        tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}.pdf`);
        await fs.writeFile(tempFilePath, file.buffer);
        const pdfExtract = new PDFExtract();
        const data = await pdfExtract.extract(tempFilePath);
        fullText = data.pages
          .map((page) => page.content.map((item) => item.str).join(" "))
          .join("\n");
      } else if (
        file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const { value } = await mammoth.default.extractRawText({
          buffer: file.buffer,
        });
        fullText = value;
      } else {
        fullText = file.buffer.toString("utf-8");
      }

      const count = await AdminService.processBookUpload(
        parseInt(topicId),
        fullText
      );
      
      logger.info(`Background processing complete. Added ${count} blocks to Topic ${topicId}`);
      
    } catch (error) {
      logger.error(`Background Upload Failed: ${error.message}`);
    } finally {
      if (tempFilePath) {
        try { await fs.unlink(tempFilePath); } catch (e) {}
      }
    }
  });
};