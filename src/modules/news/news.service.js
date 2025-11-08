// This service will hold the "business logic" for news
import { summarizeArticle } from '../../services/aiService.js';

// A helper for custom errors
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Logic to build the GNews parameters
export const buildGNewsParams = async (query) => {
  const {
    mode = 'top-headlines',
    keyword = '',
    date = '',
    category = 'general',
    source = '',
    language = 'en',
    country = 'in',
    sortBy = 'publishedAt',
  } = query;

  const params = {
    token: process.env.GNEWS_API_KEY,
    lang: language,
  };

  if (mode === 'top-headlines') {
    params.country = country;
    params.topic = category;
    if (source) params.source = source;
  } else { // search mode
    if (!keyword) {
      throw new AppError('Keyword is required for search mode.', 400);
    }
    params.q = keyword;
    if (date) {
      params.from = `${date}T00:00:00Z`;
      params.to = `${date}T23:59:59Z`;
    }
    params.sortby = sortBy;
  }
  return params;
};

// Logic to get the summary
export const getSummary = async (content) => {
  return summarizeArticle(content);
};