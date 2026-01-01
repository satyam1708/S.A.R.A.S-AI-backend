import * as questionService from './question-bank.service.js';

export const listQuestions = async (req, res) => {
  try {
    //
    const { page, limit, search, topicId, difficulty, mockTestId } = req.query;
    
    const result = await questionService.getQuestions(page, limit, {
      search,
      topicId,
      difficulty,
      mockTestId // Pass it to service
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const createQuestion = async (req, res) => {
  try {
    // We expect topicId, question data, and optional mockTestId
    const result = await questionService.createQuestion(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error("Create Error:", error);
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
    res.status(500).json({ error: error.message });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await questionService.updateQuestion(id, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "Failed to update question" });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    await questionService.deleteQuestion(id);
    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete question" });
  }
};