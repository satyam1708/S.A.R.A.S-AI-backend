import * as questionService from './question-bank.service.js';
import logger from '../../lib/logger.js'; // Enterprise Logger

export const listQuestions = async (req, res) => {
  try {
    // Validated query params are available in req.query via Zod (if using strict parsing)
    // But since we use transforms in validation, we can access them directly or rely on the service to handle types.
    // Ideally, the validation middleware puts the parsed output back into req.query.
    // If not, we just destructure and rely on service parsing.
    
    const { page, limit, search, topicId, difficulty, mockTestId } = req.query;
    
    const result = await questionService.getQuestions(page, limit, {
      search,
      topicId,
      difficulty,
      mockTestId 
    });
    res.json(result);
  } catch (error) {
    logger.error(`List Questions Failed: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
};

export const createQuestion = async (req, res) => {
  try {
    const result = await questionService.createQuestion(req.body);
    logger.info(`Question Created: [ID: ${result.id}] for Topic ${result.topicId}`);
    res.status(201).json(result);
  } catch (error) {
    logger.error(`Create Question Failed: ${error.message}`);
    res.status(500).json({ error: "Failed to create question" });
  }
};

export const getQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await questionService.getQuestionById(id);
    if (!question) return res.status(404).json({ error: "Question not found" });
    res.json(question);
  } catch (error) {
    logger.error(`Get Question Failed [ID: ${req.params.id}]: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await questionService.updateQuestion(id, req.body);
    logger.info(`Question Updated: [ID: ${id}]`);
    res.json(updated);
  } catch (error) {
    logger.error(`Update Question Failed [ID: ${req.params.id}]: ${error.message}`);
    res.status(500).json({ error: "Failed to update question" });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    await questionService.deleteQuestion(id);
    logger.info(`Question Deleted: [ID: ${id}]`);
    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    logger.error(`Delete Question Failed [ID: ${req.params.id}]: ${error.message}`);
    res.status(500).json({ error: "Failed to delete question" });
  }
};