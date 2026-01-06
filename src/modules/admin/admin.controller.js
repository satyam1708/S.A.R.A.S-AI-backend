import { createRequire } from "module";
import * as AdminService from "./admin.service.js";
import logger from "../../lib/logger.js";

// Initialize require for CommonJS modules (pdf-parse, mammoth)
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

// --- Subjects ---
export const createSubject = async (req, res, next) => {
  try {
    const subject = await AdminService.createSubject(req.body.name);
    logger.info(`Subject created: ${subject.name} [ID: ${subject.id}]`);
    res.status(201).json(subject);
  } catch (error) {
    next(error);
  }
};

export const getSubjects = async (req, res, next) => {
  try {
    const subjects = await AdminService.getAllSubjects();
    res.json(subjects);
  } catch (error) {
    next(error);
  }
};

export const updateSubject = async (req, res, next) => {
  try {
    const subject = await AdminService.updateSubject(
      parseInt(req.params.id),
      req.body.name
    );
    res.json(subject);
  } catch (error) {
    next(error);
  }
};

export const deleteSubject = async (req, res, next) => {
  try {
    await AdminService.deleteSubject(parseInt(req.params.id));
    logger.info(`Subject deleted: ${req.params.id}`);
    res.json({ message: "Subject deleted" });
  } catch (error) {
    next(error);
  }
};

// --- Chapters ---
export const createChapter = async (req, res, next) => {
  try {
    const { name, subjectId } = req.body;
    const chapter = await AdminService.createChapter(name, parseInt(subjectId));
    res.status(201).json(chapter);
  } catch (error) {
    next(error);
  }
};

export const getChaptersBySubject = async (req, res, next) => {
  try {
    const chapters = await AdminService.getChapters(
      parseInt(req.params.subjectId)
    );
    res.json(chapters);
  } catch (error) {
    next(error);
  }
};

export const updateChapter = async (req, res, next) => {
  try {
    const chapter = await AdminService.updateChapter(
      parseInt(req.params.id),
      req.body.name
    );
    res.json(chapter);
  } catch (error) {
    next(error);
  }
};

export const deleteChapter = async (req, res, next) => {
  try {
    await AdminService.deleteChapter(parseInt(req.params.id));
    res.json({ message: "Chapter deleted" });
  } catch (error) {
    next(error);
  }
};

// --- Topics ---
export const createTopic = async (req, res, next) => {
  try {
    const { name, subjectId, chapterId } = req.body;
    const topic = await AdminService.createTopic(
      name,
      parseInt(subjectId),
      chapterId ? parseInt(chapterId) : null
    );
    res.status(201).json(topic);
  } catch (error) {
    next(error);
  }
};

export const getTopicsBySubject = async (req, res, next) => {
  try {
    const topics = await AdminService.getTopics(parseInt(req.params.subjectId));
    res.json(topics);
  } catch (error) {
    next(error);
  }
};

export const updateTopic = async (req, res, next) => {
  try {
    const topic = await AdminService.updateTopic(
      parseInt(req.params.id),
      req.body.name
    );
    res.json(topic);
  } catch (error) {
    next(error);
  }
};

export const deleteTopic = async (req, res, next) => {
  try {
    await AdminService.deleteTopic(parseInt(req.params.id));
    res.json({ message: "Topic deleted" });
  } catch (error) {
    next(error);
  }
};

// --- Content Blocks ---
export const addContentBlock = async (req, res, next) => {
  try {
    const { topicId, content } = req.body;
    const block = await AdminService.addContent(parseInt(topicId), content);
    res.status(201).json(block);
  } catch (error) {
    next(error);
  }
};

export const updateContentBlock = async (req, res, next) => {
  try {
    const { content } = req.body;
    const block = await AdminService.updateContent(
      parseInt(req.params.blockId),
      content
    );
    res.json(block);
  } catch (error) {
    next(error);
  }
};

export const getContentForTopic = async (req, res, next) => {
  try {
    const blocks = await AdminService.getContent(parseInt(req.params.topicId));
    res.json(blocks);
  } catch (error) {
    next(error);
  }
};

export const deleteContentBlock = async (req, res, next) => {
  try {
    await AdminService.deleteContent(parseInt(req.params.blockId));
    res.status(200).json({ message: "Content block deleted" });
  } catch (error) {
    next(error);
  }
};

// --- Quizzes ---
export const generateQuizForTopic = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const quiz = await AdminService.generateQuiz(parseInt(topicId));
    res.status(201).json(quiz);
  } catch (error) {
    next(error);
  }
};

export const getQuizzesForTopic = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const quizzes = await AdminService.getQuizzesForTopic(parseInt(topicId));
    res.json(quizzes);
  } catch (error) {
    next(error);
  }
};

export const deleteQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    await AdminService.deleteQuiz(parseInt(quizId));
    res.status(200).json({ message: "Quiz deleted" });
  } catch (error) {
    next(error);
  }
};

// --- File Upload (Enterprise: In-Memory Processing) ---
export const uploadBookContent = async (req, res, next) => {
  const { topicId } = req.params;
  const file = req.file;

  if (!file) return res.status(400).json({ message: "No file was uploaded." });

  // 1. Respond Immediately
  res.status(202).json({
    message: "File accepted. Content processing started in background.",
    status: "PROCESSING",
  });

  // 2. Process in Background (Serverless Safe)
  setImmediate(async () => {
    try {
      logger.info(`Starting in-memory book upload for Topic ${topicId}`);
      let fullText = "";

      if (file.mimetype === "application/pdf") {
        // Parse Buffer Directly using the required pdf-parse module
        const data = await pdfParse(file.buffer);
        fullText = data.text;
      } else if (
        file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        // Use the required mammoth module
        const { value } = await mammoth.extractRawText({ buffer: file.buffer });
        fullText = value;
      } else {
        fullText = file.buffer.toString("utf-8");
      }

      if (!fullText.trim()) {
        logger.warn(`Empty content extracted for Topic ${topicId}`);
        return;
      }

      const count = await AdminService.processBookUpload(
        parseInt(topicId),
        fullText
      );

      logger.info(
        `Background processing complete. Added ${count} blocks to Topic ${topicId}`
      );
    } catch (error) {
      logger.error(`Background Upload Failed: ${error.message}`);
    }
  });
};
