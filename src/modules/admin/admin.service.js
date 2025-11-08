// src/modules/admin/admin.service.js
import prisma from '../../lib/prisma.js';

// --- Subject Management ---
export const createSubject = (name) => {
  return prisma.subject.create({ data: { name } });
};

export const getAllSubjects = () => {
  return prisma.subject.findMany({
    include: { _count: { select: { topics: true } } }
  });
};

// --- Topic Management ---
export const createTopic = (name, subjectId) => {
  return prisma.topic.create({ data: { name, subjectId } });
};

export const getTopics = (subjectId) => {
  return prisma.topic.findMany({
    where: { subjectId },
    include: { _count: { select: { content: true } } }
  });
};

// --- Content Management ---
export const addContent = (topicId, content) => {
  return prisma.contentBlock.create({ data: { topicId, content } });
};

export const getContent = (topicId) => {
  return prisma.contentBlock.findMany({
    where: { topicId },
    orderBy: { id: 'asc' }
  });
};

export const deleteContent = (blockId) => {
  return prisma.contentBlock.delete({ where: { id: blockId } });
};