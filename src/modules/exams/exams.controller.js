import * as examService from './exams.service.js';

export const generateMock = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title } = req.body; // Optional title
    const mock = await examService.generateMockExam(courseId, title);
    res.status(201).json(mock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate exam" });
  }
};

export const uploadPYQ = async (req, res) => {
  try {
    // Assuming file is uploaded via middleware and text is extracted
    // For PDF, you'd use 'pdf-parse' in the controller or service
    // Here we assume 'req.body.text' contains the extracted text for simplicity
    const { text, courseId, year, source } = req.body; 
    
    const result = await examService.processPreviousYearPaper(text, courseId, year, source);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
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