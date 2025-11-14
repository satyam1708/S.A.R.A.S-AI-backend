// src/modules/admin/admin.controller.js
import * as AdminService from './admin.service.js';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth'

// --- Subject Management ---
export const createSubject = async (req, res) => {
  try {
    const subject = await AdminService.createSubject(req.body.name);
    res.status(201).json(subject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSubjects = async (req, res) => {
  try {
    const subjects = await AdminService.getAllSubjects();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Topic Management ---
export const createTopic = async (req, res) => {
  try {
    const { name, subjectId } = req.body;
    const topic = await AdminService.createTopic(name, subjectId);
    res.status(201).json(topic);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTopicsBySubject = async (req, res) => {
  try {
    const topics = await AdminService.getTopics(parseInt(req.params.subjectId));
    res.json(topics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Content Management ---
export const addContentBlock = async (req, res) => {
  try {
    const { topicId, content } = req.body;
    const block = await AdminService.addContent(topicId, content);
    res.status(201).json(block);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getContentForTopic = async (req, res) => {
  try {
    const blocks = await AdminService.getContent(parseInt(req.params.topicId));
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteContentBlock = async (req, res) => {
  try {
    await AdminService.deleteContent(parseInt(req.params.blockId));
    res.status(200).json({ message: 'Content block deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- [NEW] Quiz Management ---

export const generateQuizForTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const quiz = await AdminService.generateQuiz(parseInt(topicId));
    res.status(201).json(quiz);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * --- UPDATED ---
 * Renamed function to reflect it gets *all* quizzes.
 */
export const getQuizzesForTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    // --- UPDATED ---
    const quizzes = await AdminService.getQuizzesForTopic(parseInt(topicId));
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    await AdminService.deleteQuiz(parseInt(quizId));
    res.status(200).json({ message: 'Quiz deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const uploadBookContent = async (req, res) => {
  try {
    const { topicId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file was uploaded.' });
    }

    let fileBuffer;
    
    // --- NEW LOGIC TO PARSE DIFFERENT FILE TYPES ---
    if (file.mimetype === 'application/pdf') {
      // --- THIS IS THE FIX ---
      // Call the function on the '.default' property
      const data = await pdfParse.default(file.buffer);
      // --- END OF FIX ---
      fileBuffer = Buffer.from(data.text, 'utf-8');
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // --- THIS IS THE FIX ---
      // Call the function on the '.default' property
      const { value } = await mammoth.default.extractRawText({ buffer: file.buffer });
      // --- END OF FIX ---
      fileBuffer = Buffer.from(value, 'utf-8');
    } else {
      // It's a .txt file, just use the buffer
      fileBuffer = file.buffer;
    }
    // --- END OF NEW LOGIC ---

    const count = await AdminService.processBookUpload(parseInt(topicId), fileBuffer);
    res.status(201).json({ message: `Successfully added ${count} new content blocks.`, count });
  } catch (error) {
    console.error("Upload Error:", error); 
    res.status(500).json({ message: error.message });
  }
};