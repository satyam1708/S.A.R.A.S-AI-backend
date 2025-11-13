import * as GsService from './gs.service.js';

export const getSubjects = async (req, res, next) => {
  try {
    const subjects = await GsService.getSubjectsAndTopics();
    res.json(subjects);
  } catch (error) {
    next(error);
  }
};

// RENAMED from getChat to getChatHistory
export const getChatHistory = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    // UPDATED to call the new service function
    const messages = await GsService.getChatHistory(req.user.id, parseInt(topicId));
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

// RENAMED from postChat to postMessage
export const postMessage = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const { message } = req.body;
    // UPDATED to call the new service function
    const aiResponse = await GsService.postNewMessage(req.user.id, parseInt(topicId), message);
    res.json({ role: 'assistant', content: aiResponse });
  } catch (error) {
    next(error);
  }
};

export const streamMessage = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const { message } = req.body;
    const { id: userId } = req.user;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // 1. Get the stream and session ID from the service
    const { stream, sessionId } = await GsService.streamNewMessage(
      userId,
      parseInt(topicId),
      message
    );

    // 2. Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';

    // 3. Iterate over the stream
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        // 4. Write data in SSE format
        res.write(`data: ${JSON.stringify(content)}\n\n`);
      }
    }

    // 5. After the stream ends, save the full response
    await GsService.saveAiResponse(sessionId, fullResponse);

    // 6. Send a final "end" event
    res.write('event: end\ndata: {}\n\n');
    res.end();
  } catch (error) {
    next(error); // Pass errors to your middleware
  }
};

export const markTopicAsLearned = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    await GsService.markTopicAsLearned(req.user.id, parseInt(topicId));
    res.status(200).json({ message: 'Topic marked as learned.' });
  } catch (error)
 {
    next(error);
  }
};

export const getRevision = async (req, res, next) => {
  try {
    // RENAMED service function for clarity
    const revision = await GsService.getRevisionForUser(req.user.id);
    res.json({ role: 'assistant', content: revision });
  } catch (error) {
    next(error);
  }
};

// This is your new function, it's correct.
export const createChatFromContext = async (req, res, next) => {
  try {
    const { id: userId } = req.user; // From authMiddleware
    const { context } = req.body; // e.g., "Article title about Quantum Computing"

    if (!context) {
      return res.status(400).json({ message: 'Context is required' });
    }

    // Call the service to do the heavy lifting
    const newTopic = await GsService.createTopicFromContext(userId, context);

    // Return the newly created topic. The frontend will use its ID.
    res.status(201).json(newTopic);
  } catch (error) {
    next(error);
  }
};


// --- [NEW] Quiz Functions for Students ---

export const getQuizForTopic = async (req, res, next) => {
  try {
    const { topicId } = req.params;
    const quiz = await GsService.getQuiz(parseInt(topicId));
    res.json(quiz);
  } catch (error) {
    next(error);
  }
};

export const submitQuizForTopic = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body; // Expects: [{ questionId: 1, selectedAnswerIndex: 2 }, ...]
    const { id: userId } = req.user;

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