// src/modules/gs/gs.controller.js
import * as GsService from "./gs.service.js";
import { generateEducationalImage } from "../../services/aiService.js";

export const getSubjects = async (req, res, next) => {
  try {
    const subjects = await GsService.getSubjectsAndTopics();
    res.json(subjects);
  } catch (error) {
    next(error);
  }
};

export const getChatHistory = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const messages = await GsService.getChatHistory(
      req.user.id,
      parseInt(topicId)
    );
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

export const postMessage = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const { message } = req.body;
    const aiResponse = await GsService.postNewMessage(
      req.user.id,
      parseInt(topicId),
      message
    );
    res.json({ role: "assistant", content: aiResponse });
  } catch (error) {
    next(error);
  }
};

/**
 * Optimized Streaming Endpoint
 */
export const streamMessage = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const { message } = req.body;
    const { id: userId } = req.user;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const { stream, sessionId } = await GsService.streamNewMessage(
      userId,
      parseInt(topicId),
      message
    );

    // 1. SSE Headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";
    let isInterrupted = false;

    // 2. Interruption Handler
    req.on("close", () => {
      isInterrupted = true;
      res.end();
    });

    // 3. Pipe Stream
    for await (const chunk of stream) {
      if (isInterrupted || res.writableEnded) break;

      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        // Standardized JSON format: {"content": "token"}
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // 4. End Stream & Save (only if completed)
    if (!res.writableEnded && !isInterrupted) {
      res.write("data: [DONE]\n\n");
      res.end();
      // Only save complete responses to keep chat history clean
      await GsService.saveAiResponse(sessionId, fullResponse);
    }
  } catch (error) {
    console.error("Stream Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
};

// ... (Keep existing handlers for markTopicAsLearned, getRevision, createChatFromContext, Quiz, Flashcards) ...
export const markTopicAsLearned = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    await GsService.markTopicAsLearned(req.user.id, parseInt(topicId));
    res.status(200).json({ message: "Topic marked as learned." });
  } catch (error) {
    next(error);
  }
};

export const getRevision = async (req, res, next) => {
  try {
    const revision = await GsService.getRevisionForUser(req.user.id);
    res.json({ role: "assistant", content: revision });
  } catch (error) {
    next(error);
  }
};

export const createChatFromContext = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { context } = req.body;
    if (!context)
      return res.status(400).json({ message: "Context is required" });
    const newTopic = await GsService.createTopicFromContext(userId, context);
    res.status(201).json(newTopic);
  } catch (error) {
    next(error);
  }
};

export const getQuizzesForTopic = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const quizzes = await GsService.getQuizzesForTopic(parseInt(topicId));
    res.json(quizzes);
  } catch (error) {
    next(error);
  }
};

export const checkAnswer = async (req, res, next) => {
  try {
    const { questionId, selectedAnswerIndex } = req.body;
    if (questionId == null || selectedAnswerIndex == null) {
      return res.status(400).json({ message: "Missing data." });
    }
    const result = await GsService.checkAnswer(
      parseInt(questionId),
      parseInt(selectedAnswerIndex)
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const submitQuizForTopic = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body;
    const { id: userId } = req.user;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "Invalid answers." });
    }
    const results = await GsService.submitQuiz(
      userId,
      parseInt(quizId),
      answers
    );
    res.json(results);
  } catch (error) {
    next(error);
  }
};

export const getDueFlashcardsController = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const cards = await GsService.getDueFlashcards(userId);
    res.json(cards);
  } catch (error) {
    next(error);
  }
};

export const reviewFlashcardController = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { flashcardId, rating } = req.body;
    if (flashcardId == null || rating == null) {
      return res.status(400).json({ message: "Missing data." });
    }
    await GsService.reviewFlashcard(
      userId,
      parseInt(flashcardId),
      parseInt(rating)
    );
    res.status(200).json({ message: "Review recorded." });
  } catch (error) {
    next(error);
  }
};

// [UPDATED] Image Generation Controller
export const generateImage = async (req, res, next) => {
  try {
    const { topicId } = req.params; // Get context
    const { prompt } = req.body;
    const { id: userId } = req.user;

    if (!prompt) return res.status(400).json({ message: "Prompt is required" });

    // Call the smart service that saves everything
    const message = await GsService.generateAndSaveImage(userId, parseInt(topicId), prompt);
    
    res.json(message); // Return the full message object (with ID, content, imageUrl)
  } catch (error) {
    next(error);
  }
};