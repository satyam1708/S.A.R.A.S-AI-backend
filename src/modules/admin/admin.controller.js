// src/modules/admin/admin.controller.js
import * as AdminService from './admin.service.js';

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