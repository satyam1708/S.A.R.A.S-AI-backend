// This service will hold the "business logic" for news
import { summarizeArticle,generateNewsBroadcast } from '../../services/aiService.js';

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

export const getRadioBroadcast = async (category) => {
  // 1. Get top 5 headlines for the category
  const params = {
    token: process.env.GNEWS_API_KEY,
    lang: 'en',
    country: 'in',
    topic: category || 'general',
    max: 5, // Let's start with 5 articles for one broadcast
  };
  const url = 'https://gnews.io/api/v4/top-headlines';

  const response = await axios.get(url.toString(), {
    params,
    timeout: 15000,
  });

  if (!response.data.articles || response.data.articles.length === 0) {
    throw new AppError('No articles found to generate a broadcast.', 404);
  }

  // 2. Format articles for the AI
  const articlesContent = response.data.articles
    .map((article, i) => {
      return `Article ${i + 1}:
Title: ${article.title}
Content: ${article.description || article.content}
Source: ${article.source.name}`;
    })
    .join('\n\n');

  // 3. Call the AI to generate the script
  // We pass an empty array for messages because this is the *start* of the broadcast
  const script = await generateNewsBroadcast(articlesContent, category, []);
  return { script, articles: response.data.articles }; // Return script and articles
};

// --- NEW SERVICE for AI Radio Chat ---
export const getRadioChatResponse = async (userMessage, broadcastScript, chatHistory) => {
  // 1. Format the articles from the script (or just pass the whole script)
  const articlesContent = `Here is the full broadcast script I am reading from:\n${broadcastScript}`;

  // 2. Create the message history
  const messages = [
    ...chatHistory, // Pass previous messages
    { role: 'user', content: userMessage },
  ];

  // 3. Call the AI
  // We pass the *same* category to maintain the persona
  const response = await generateNewsBroadcast(articlesContent, "Radio Chat", messages);
  return response;
};