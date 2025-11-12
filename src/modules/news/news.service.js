// This service will hold the "business logic" for news
import axios from 'axios';
import Parser from 'rss-parser';
import { summarizeArticle, generateNewsBroadcast } from '../../services/aiService.js';

// A helper for custom errors
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// --- UPDATED AND VERIFIED RSS FEEDS ---
const RSS_FEEDS = {
  general: [
    { url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', source: 'Times of India' },
    { url: 'https://www.hindustantimes.com/feeds/rss/latest-news/rssfeed.xml', source: 'Hindustan Times' },
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC News' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'The New York Times' },
  ],
  technology: [
    { url: 'https://timesofindia.indiatimes.com/rssfeeds/5880659.cms', source: 'Times of India' },
    { url: 'https://www.hindustantimes.com/feeds/rss/technology/rssfeed.xml', source: 'Hindustan Times' },
    { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC Technology' },
  ],
  sports: [
    { url: 'https://timesofindia.indiatimes.com/rssfeeds/4719148.cms', source: 'Times of India' },
    { url: 'https://www.hindustantimes.com/feeds/rss/sports/rssfeed.xml', source: 'Hindustan Times' },
    { url: 'https://feeds.bbci.co.uk/sport/rss.xml', source: 'BBC Sport' },
  ],
  business: [
    { url: 'https://timesofindia.indiatimes.com/rssfeeds/1898055.cms', source: 'Times of India' },
    { url: 'https://www.hindustantimes.com/feeds/rss/business/rssfeed.xml', source: 'Hindustan Times' },
    { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
  ],
  entertainment: [
    { url: 'https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms', source: 'Times of India' },
    { url: 'https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml', source: 'Hindustan Times' },
  ],
  health: [
    { url: 'https://www.hindustantimes.com/feeds/rss/health/rssfeed.xml', source: 'Hindustan Times' },
    { url: 'https://feeds.bbci.co.uk/news/health/rss.xml', source: 'BBC Health' },
  ],
  science: [
    { url: 'https://www.hindustantimes.com/feeds/rss/science/rssfeed.xml', source: 'Hindustan Times' },
    { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Science' },
  ]
};

/**
 * Normalizes an article from GNews or RSS to our standard format
 * @param {object} article - The source article
 * @param {'gnews' | 'rss'} type - The source type
 * @param {string} [defaultSource] - (For RSS) The fallback source name
 * @returns {object | null} A normalized article object or null if invalid
 */
const normalizeArticle = (article, type, defaultSource) => {
  try {
    if (type === 'gnews') {
      return {
        title: article.title,
        description: article.description,
        url: article.url,
        image: article.image,
        publishedAt: new Date(article.publishedAt),
        sourceName: article.source.name,
      };
    }
    if (type === 'rss') {
      return {
        title: article.title,
        // Get description and strip any HTML tags
        description: (article.contentSnippet || article.content || '').replace(/<[^>]+>/g, ''),
        url: article.link,
        image: article.enclosure?.url || null,
        publishedAt: new Date(article.pubDate),
        sourceName: article.creator || defaultSource, // Use the provided default
      };
    }
  } catch (error) {
    console.error('Failed to normalize article:', article.title, error);
    return null; // Skip this article if it's malformed
  }
};

/**
 * Removes duplicate articles based on URL or Title
 * @param {Array<object>} articles - An array of normalized articles
 * @returns {Array<object>} A unique array of articles
 */
const deDuplicateArticles = (articles) => {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const unique = [];

  for (const article of articles) {
    // Check for valid article and URL
    if (!article || !article.url) continue;

    if (!seenUrls.has(article.url) && !seenTitles.has(article.title)) {
      seenUrls.add(article.url);
      seenTitles.add(article.title);
      unique.push(article);
    }
  }
  return unique;
};

/**
 * Fetches and parses articles from all RSS feeds for a given category
 * @param {string} category - The news category (e.g., 'general', 'technology')
 * @returns {Promise<Array<object>>} A promise resolving to an array of normalized articles
 */
const fetchFromRss = async (category = 'general') => {
  const parser = new Parser();
  const feedList = RSS_FEEDS[category] || RSS_FEEDS.general;
  
  // Create an array of promises, one for each feed URL
  const fetchPromises = feedList.map(feedInfo =>
    parser.parseURL(feedInfo.url)
      .then(feed => feed.items
        .map(item => normalizeArticle(item, 'rss', feedInfo.source))
        .filter(Boolean) // Filter out any nulls from normalization
      )
      .catch(error => {
        console.error(`Error fetching RSS from ${feedInfo.url}:`, error.message);
        return []; // Return empty array on failure, don't break the chain
      })
  );

  // Wait for all feeds to either succeed or fail
  const allFeedsResults = await Promise.all(fetchPromises);
  
  // allFeedsResults is an array of arrays, so we flatten it
  return allFeedsResults.flat();
};

/**
 * Fetches articles from GNews as a fallback
 * @param {string} category - The news category
 * @param {string} language - The language code (e.g., 'en')
 * @returns {Promise<Array<object>>} A promise resolving to an array of normalized articles
 */
const fetchFromGNews = async (category = 'general', language = 'en') => {
  // GNews is now just a fallback, not the primary source
  const url = 'https://gnews.io/api/v4/top-headlines';
  const params = {
    token: process.env.GNEWS_API_KEY,
    lang: language,
    country: 'in',
    topic: category,
  };
  try {
    const response = await axios.get(url, { params, timeout: 15000 });
    return (response.data.articles || [])
      .map(article => normalizeArticle(article, 'gnews', null))
      .filter(Boolean);
  } catch (error) {
    console.error('Error fetching GNews:', error.message);
    return [];
  }
};

/**
 * Gets real-time headlines by aggregating RSS and GNews
 * @param {string} category - The news category
 * @param {string} language - The language code
 * @returns {Promise<Array<object>>} A promise resolving to a unique, sorted array of articles
 */
export const getHeadlines = async (category, language) => {
  // Fetch from all sources in parallel
  const [rssArticles, gnewsArticles] = await Promise.all([
    fetchFromRss(category),
    fetchFromGNews(category, language)
  ]);

  const allArticles = [...rssArticles, ...gnewsArticles];
  const uniqueArticles = deDuplicateArticles(allArticles);

  // Sort by date, newest first
  uniqueArticles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return uniqueArticles;
};

// --- THIS IS THE UPDATED FUNCTION ---

/**
 * Searches GNews AND RSS for articles based on query parameters
 * @param {object} query - The query params from the request (keyword, date, etc.)
 * @returns {Promise<object>} A promise resolving to { articles, totalArticles }
 */
export const searchNews = async (query) => {
  const {
    keyword = 'India', // Default to 'India' if no keyword
    date = '',
    language = 'en',
    country = 'in',
    sortBy = 'publishedAt',
  } = query;

  // --- 1. Fetch from GNews (for historical/keyword match) ---
  const gnewsParams = {
    token: process.env.GNEWS_API_KEY,
    lang: language,
    country: country,
    q: keyword,
    sortby: sortBy,
  };

  if (date) {
    gnewsParams.from = `${date}T00:00:00Z`;
    gnewsParams.to = `${date}T23:59:59Z`;
  }

  const gnewsUrl = 'https://gnews.io/api/v4/search';
  let gnewsArticles = [];

  try {
    const response = await axios.get(gnewsUrl, { params: gnewsParams, timeout: 15000 });
    gnewsArticles = (response.data.articles || [])
      .map(article => normalizeArticle(article, 'gnews', null))
      .filter(Boolean);
  } catch (error) {
    console.error('Error in GNews search:', error.message);
    // Don't throw, just continue to RSS feeds
  }

  // --- 2. Fetch from ALL RSS feeds (for real-time data) ---
  // We fetch all categories to create a large pool to search from
  const rssCategories = Object.keys(RSS_FEEDS);
  const rssFetchPromises = rssCategories.map(category => fetchFromRss(category));
  const allRssFeeds = await Promise.all(rssFetchPromises);
  let rssArticles = allRssFeeds.flat();

  // --- 3. Combine and De-duplicate ---
  const allArticles = [...gnewsArticles, ...rssArticles];
  let uniqueArticles = deDuplicateArticles(allArticles);

  // --- 4. Apply our own backend filters ---
  
  // Helper to check if two dates are the same day (ignoring time)
  const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // Filter by Date (if provided)
  if (date) {
    // Create a date object that correctly handles timezone
    // We add 'T12:00:00Z' to make it UTC noon, avoiding timezone shifts
    const targetDate = new Date(`${date}T12:00:00Z`);
    uniqueArticles = uniqueArticles.filter(article => 
      isSameDay(article.publishedAt, targetDate)
    );
  }

  // Filter by Keyword
  if (keyword) {
    const lowerKeyword = keyword.toLowerCase();
    uniqueArticles = uniqueArticles.filter(article =>
      (article.title && article.title.toLowerCase().includes(lowerKeyword)) ||
      (article.description && article.description.toLowerCase().includes(lowerKeyword))
    );
  }

  // --- 5. Sort and Return ---
  uniqueArticles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return { articles: uniqueArticles, totalArticles: uniqueArticles.length };
};

// --- END OF UPDATED FUNCTION ---


/**
 * [DEPRECATED] Builds params for the old GNews route
 * This function is no longer needed by the new aggregator but
 * might be used by an old route. We can leave it for now.
 */
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

/**
 * Generates an AI summary for a given string of content
 * @param {string} content - The article content to summarize
 * @returns {Promise<string>} A promise resolving to the AI summary
 */
export const getSummary = async (content) => {
  // Sanitize content before sending to AI
  const cleanContent = content ? content.replace(/<[^>]+>/g, '') : '';
  if (!cleanContent) {
    throw new AppError('Cannot summarize empty content.', 400);
  }
  return summarizeArticle(cleanContent);
};

/**
 * Generates an AI radio broadcast script
 * @param {string} category - The news category
 * @param {string} language - The language code (e.g., 'en-US')
 * @returns {Promise<object>} A promise resolving to { script, articles }
 */
export const getRadioBroadcast = async (category, language) => {
  // 1. Get headlines from our new combined feed
  const articles = await getHeadlines(category, language);
  const top5 = articles.slice(0, 5);

  if (top5.length === 0) {
    throw new AppError('No articles found to generate a broadcast.', 404);
  }

  // 2. Format content for the AI
  const articlesContent = top5
    .map(a => `${a.title}. ${a.description || ''}`) // Handle possible missing description
    .join('\n\n');

  // 3. Call the AI to generate the script
  const script = await generateNewsBroadcast(articlesContent, category, [], language);
  return { script, articles: top5 }; // Return the normalized articles
};

/**
 * Generates an AI response for the radio chat
 * @param {string} userMessage - The user's chat message
 * @param {string} broadcastScript - The current broadcast script
 * @param {Array<object>} chatHistory - The last few chat messages
 * @param {string} language - The language code (e.g., 'en-US')
 * @returns {Promise<object>} A promise resolving to { role: 'assistant', content: ... }
 */
export const getRadioChatResponse = async (userMessage, broadcastScript, chatHistory, language) => {
  const articlesContent = `Here is the full broadcast script I am reading from:\n${broadcastScript}`;

  const messages = [
    ...chatHistory,
    { role: 'user', content: userMessage },
  ];

  const response = await generateNewsBroadcast(articlesContent, "Radio Chat", messages, language);
  return { role: 'assistant', content: response }; // Return as an object
};