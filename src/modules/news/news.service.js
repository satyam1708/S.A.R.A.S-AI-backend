// src/modules/news/news.service.js
import axios from "axios";
import Parser from "rss-parser";
import {
  summarizeArticle,
  generateNewsBroadcast,
} from "../../services/aiService.js";
import prisma from "../../lib/prisma.js";
import logger from "../../lib/logger.js"; // Enterprise Logger
import https from 'https';

// --- CONFIG ---
const RSS_FEEDS = {
  general: [
    {
      url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
      source: "Times of India",
    },
    {
      url: "https://www.hindustantimes.com/feeds/rss/latest-news/rssfeed.xml",
      source: "Hindustan Times",
    },
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC News" },
    {
      url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
      source: "The New York Times",
    },
  ],
  technology: [
    {
      url: "https://timesofindia.indiatimes.com/rssfeeds/5880659.cms",
      source: "Times of India",
    },
    {
      url: "https://www.hindustantimes.com/feeds/rss/technology/rssfeed.xml",
      source: "Hindustan Times",
    },
    {
      url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
      source: "BBC Technology",
    },
  ],
  sports: [
    {
      url: "https://timesofindia.indiatimes.com/rssfeeds/4719148.cms",
      source: "Times of India",
    },
    {
      url: "https://www.hindustantimes.com/feeds/rss/sports/rssfeed.xml",
      source: "Hindustan Times",
    },
    { url: "https://feeds.bbci.co.uk/sport/rss.xml", source: "BBC Sport" },
  ],
  business: [
    {
      url: "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms",
      source: "Times of India",
    },
    {
      url: "https://www.hindustantimes.com/feeds/rss/business/rssfeed.xml",
      source: "Hindustan Times",
    },
    {
      url: "https://feeds.bbci.co.uk/news/business/rss.xml",
      source: "BBC Business",
    },
  ],
  entertainment: [
    {
      url: "https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms",
      source: "Times of India",
    },
    {
      url: "https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml",
      source: "Hindustan Times",
    },
  ],
  health: [
    {
      url: "https://www.hindustantimes.com/feeds/rss/health/rssfeed.xml",
      source: "Hindustan Times",
    },
    {
      url: "https://feeds.bbci.co.uk/news/health/rss.xml",
      source: "BBC Health",
    },
  ],
  science: [
    {
      url: "https://www.hindustantimes.com/feeds/rss/science/rssfeed.xml",
      source: "Hindustan Times",
    },
    {
      url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
      source: "BBC Science",
    },
  ],
};

// In-Memory Cache (Level 1)
const headlinesCache = {
  general: { articles: [], timestamp: 0 },
  technology: { articles: [], timestamp: 0 },
  sports: { articles: [], timestamp: 0 },
  business: { articles: [], timestamp: 0 },
  entertainment: { articles: [], timestamp: 0 },
  health: { articles: [], timestamp: 0 },
  science: { articles: [], timestamp: 0 },
};
const CACHE_DURATION = 10 * 60 * 1000;

// --- UTILITIES ---

const normalizeArticle = (article, type, defaultSource) => {
  try {
    if (type === "gnews") {
      return {
        title: article.title,
        description: article.description,
        url: article.url,
        image: article.image,
        publishedAt: new Date(article.publishedAt),
        sourceName: article.source.name,
      };
    }
    if (type === "rss") {
      return {
        title: article.title,
        description: (article.contentSnippet || article.content || "").replace(
          /<[^>]+>/g,
          ""
        ),
        url: article.link,
        image: article.enclosure?.url || null,
        publishedAt: new Date(article.pubDate),
        sourceName: article.creator || defaultSource,
      };
    }
  } catch (error) {
    // Silent fail for malformed articles
    return null;
  }
};

const deDuplicateArticles = (articles) => {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const unique = [];

  for (const article of articles) {
    if (!article || !article.url) continue;
    if (!seenUrls.has(article.url) && !seenTitles.has(article.title)) {
      seenUrls.add(article.url);
      seenTitles.add(article.title);
      unique.push(article);
    }
  }
  return unique;
};

// FIX: Create an Agent that is less strict about SSL (for older RSS feeds)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false // WARNING: Use cautiously. Fixes "EPROTO" errors for some feeds.
});

const fetchFromRss = async (category = "general") => {
  // FIX: Pass the agent to the parser
  const parser = new Parser({
    requestOptions: {
      agent: httpsAgent 
    }
  });
  
  const feedList = RSS_FEEDS[category] || RSS_FEEDS.general;

  const fetchPromises = feedList.map((feedInfo) =>
    parser
      .parseURL(feedInfo.url)
      .then((feed) =>
        feed.items
          .map((item) => normalizeArticle(item, "rss", feedInfo.source))
          .filter(Boolean)
      )
      .catch((error) => {
        // Just log warning, don't crash
        logger.warn(`RSS Fetch Failed [${feedInfo.url}]: ${error.message}`);
        return [];
      })
  );

  const allFeedsResults = await Promise.all(fetchPromises);
  return allFeedsResults.flat();
};

const fetchFromGNews = async (category = "general", language = "en") => {
  const url = "https://gnews.io/api/v4/top-headlines";
  const params = {
    token: process.env.GNEWS_API_KEY,
    lang: language,
    country: "in",
    topic: category,
  };
  try {
    const response = await axios.get(url, { params, timeout: 15000 });
    return (response.data.articles || [])
      .map((article) => normalizeArticle(article, "gnews", null))
      .filter(Boolean);
  } catch (error) {
    logger.warn(`GNews Fetch Failed: ${error.message}`);
    return [];
  }
};

// --- CORE SERVICES ---

export const getHeadlines = async (category, language) => {
  const now = Date.now();
  const cachedData = headlinesCache[category];

  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    logger.debug(`[Cache] Serving headlines for '${category}'`);
    return cachedData.articles;
  }

  logger.info(`[News] Refreshing headlines for '${category}'`);

  const [rssArticles, gnewsArticles] = await Promise.all([
    fetchFromRss(category),
    fetchFromGNews(category, language),
  ]);

  const allArticles = [...rssArticles, ...gnewsArticles];
  const uniqueArticles = deDuplicateArticles(allArticles);

  uniqueArticles.sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );

  // Update Cache
  headlinesCache[category] = {
    articles: uniqueArticles,
    timestamp: now,
  };

  return uniqueArticles;
};

export const searchNews = async (query) => {
  const {
    keyword = "India",
    date = "",
    language = "en",
    country = "in",
    sortBy = "publishedAt",
  } = query;

  // 1. Fetch GNews
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

  const gnewsUrl = "https://gnews.io/api/v4/search";
  let gnewsArticles = [];

  try {
    const response = await axios.get(gnewsUrl, {
      params: gnewsParams,
      timeout: 15000,
    });
    gnewsArticles = (response.data.articles || [])
      .map((article) => normalizeArticle(article, "gnews", null))
      .filter(Boolean);
  } catch (error) {
    logger.error(`GNews Search Error: ${error.message}`);
  }

  // 2. Fetch RSS
  const rssCategories = Object.keys(RSS_FEEDS);
  const rssFetchPromises = rssCategories.map((category) =>
    fetchFromRss(category)
  );
  const allRssFeeds = await Promise.all(rssFetchPromises);
  let rssArticles = allRssFeeds.flat();

  // 3. Merge & Filter
  const allArticles = [...gnewsArticles, ...rssArticles];
  let uniqueArticles = deDuplicateArticles(allArticles);

  const isSameDay = (d1, d2) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  if (date) {
    const targetDate = new Date(`${date}T12:00:00Z`);
    uniqueArticles = uniqueArticles.filter((article) =>
      isSameDay(article.publishedAt, targetDate)
    );
  }

  if (keyword) {
    const lowerKeyword = keyword.toLowerCase();
    uniqueArticles = uniqueArticles.filter(
      (article) =>
        (article.title && article.title.toLowerCase().includes(lowerKeyword)) ||
        (article.description &&
          article.description.toLowerCase().includes(lowerKeyword))
    );
  }

  uniqueArticles.sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );

  return { articles: uniqueArticles, totalArticles: uniqueArticles.length };
};

export const getSummary = async (content) => {
  const cleanContent = content ? content.replace(/<[^>]+>/g, "") : "";
  if (!cleanContent) {
    throw new Error("Cannot summarize empty content.");
  }
  return summarizeArticle(cleanContent);
};

export const getRadioBroadcast = async (category, language) => {
  const CACHE_DURATION_MINUTES = 30;
  const now = new Date();

  // DB Cache Check
  try {
    const cached = await prisma.cachedBroadcast.findUnique({
      where: { category_language: { category, language } },
    });

    if (cached) {
      const diffInMinutes =
        (now.getTime() - cached.updatedAt.getTime()) / (1000 * 60);
      if (diffInMinutes < CACHE_DURATION_MINUTES) {
        logger.info(`[DB Cache] Serving Radio: ${category} (${language})`);
        return { script: cached.script, articles: cached.articles };
      }
    }
  } catch (e) {
    logger.warn(`DB Cache Read Error: ${e.message}`);
  }

  // Cache Miss -> Generate
  logger.info(`[Gen] Creating new Radio: ${category} (${language})`);

  const articles = await getHeadlines(category, language);
  const top5 = articles.slice(0, 5);

  if (top5.length === 0) {
    throw new Error("No articles found to generate a broadcast.");
  }

  const articlesContent = top5
    .map((a) => `${a.title}. ${a.description || ""}`)
    .join("\n\n");

  const script = await generateNewsBroadcast(
    articlesContent,
    category,
    [],
    language
  );

  // DB Cache Write
  try {
    await prisma.cachedBroadcast.upsert({
      where: { category_language: { category, language } },
      create: {
        category,
        language,
        script,
        articles: top5,
      },
      update: {
        script,
        articles: top5,
        updatedAt: now,
      },
    });
  } catch (e) {
    logger.warn(`DB Cache Write Error: ${e.message}`);
  }

  return { script, articles: top5 };
};

export const getRadioBroadcastResponse = async (
  userMessage,
  broadcastScript,
  chatHistory,
  language
) => {
  const articlesContent = `Here is the full broadcast script I am reading from:\n${broadcastScript}`;

  const messages = [...chatHistory, { role: "user", content: userMessage }];

  const response = await generateNewsBroadcast(
    articlesContent,
    "Radio Chat",
    messages,
    language
  );
  return response;
};

// Deprecated param builder (kept for legacy support if needed)
export const buildGNewsParams = async (query) => {
  const {
    mode = "top-headlines",
    keyword = "",
    date = "",
    category = "general",
    source = "",
    language = "en",
    country = "in",
    sortBy = "publishedAt",
  } = query;

  const params = {
    token: process.env.GNEWS_API_KEY,
    lang: language,
  };

  if (mode === "top-headlines") {
    params.country = country;
    params.topic = category;
    if (source) params.source = source;
  } else {
    if (!keyword) throw new Error("Keyword is required for search mode.");
    params.q = keyword;
    if (date) {
      params.from = `${date}T00:00:00Z`;
      params.to = `${date}T23:59:59Z`;
    }
    params.sortby = sortBy;
  }
  return params;
};
