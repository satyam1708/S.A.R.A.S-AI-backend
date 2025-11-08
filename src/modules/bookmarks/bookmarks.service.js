import prisma from '../../lib/prisma.js';

// A helper for custom errors
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const create = async (userId, data) => {
  const { title, url, description, image, publishedAt, source } = data;
  if (!title || !url) {
    throw new AppError('Title and URL are required', 400);
  }

  const exists = await prisma.bookmark.findFirst({
    where: { userId, url },
  });
  if (exists) {
    throw new AppError('Bookmark already exists', 409);
  }

  return prisma.bookmark.create({
    data: {
      userId,
      title,
      description,
      url,
      image,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
      source,
    },
  });
};

export const getByUserId = async (userId) => {
  return prisma.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

export const deleteByUserAndUrl = async (userId, url) => {
  const deleted = await prisma.bookmark.deleteMany({
    where: { userId, url },
  });

  if (deleted.count === 0) {
    throw new AppError('Bookmark not found', 404);
  }
  return true;
};