import * as GsService from './gs.service.js';

export const getSubjects = async (req, res) => {
  try {
    const subjects = await GsService.getSubjectsAndTopics();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getChat = async (req, res) => {
  try {
    const { topicId } = req.params;
    const chat = await GsService.getChatSession(req.user.id, parseInt(topicId));
    res.json(chat.messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const postChat = async (req, res) => {
  try {
    const { topicId } = req.params;
    const { message } = req.body;
    const aiResponse = await GsService.postMessage(req.user.id, parseInt(topicId), message);
    res.json({ role: 'assistant', content: aiResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markAsLearned = async (req, res) => {
  try {
    const { topicId } = req.params;
    await GsService.markTopicAsLearned(req.user.id, parseInt(topicId));
    res.status(200).json({ message: 'Topic marked as learned.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRevision = async (req, res) => {
  try {
    const revision = await GsService.getRevisionForUser(req.user.id);
    res.json({ role: 'assistant', content: revision });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};