import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as NewsService from './news.service.js';

const API_KEY = process.env.GNEWS_API_KEY;

if (!API_KEY) {
  console.error('❌ ERROR: GNEWS_API_KEY is not set in environment variables!');
  process.exit(1);
}

// Setup axios retry
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) || err.code === 'ETIMEDOUT',
});


export const pingGNews = async (req, res) => {
  try {
    await axios.get('https://gnews.io');
    res.status(200).json({ success: true, message: 'GNews API reachable' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
    });
  }
};

export const getNews = async (req, res) => {
  try {
    const params = await NewsService.buildGNewsParams(req.query);
    const url = new URL(
      req.query.mode === 'top-headlines'
        ? 'https://gnews.io/api/v4/top-headlines'
        : 'https://gnews.io/api/v4/search'
    );
    
    const response = await axios.get(url.toString(), {
      params,
      timeout: 15000,
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error in /api/news:', error.message || error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch news from GNews.' });
  }
};

export const proxyImage = async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('Missing image URL');

    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying image:', error.message);
    res.status(500).send('Failed to fetch image');
  }
};

export const summarize = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: 'Article content is required' });
    }
    const summary = await NewsService.getSummary(content);
    res.json({ summary });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getRadioBroadcast = async (req, res) => {
  try {
    const { category = 'general', language = 'en-US' } = req.body; // <-- GET LANGUAGE
    const { script, articles } = await NewsService.getRadioBroadcast(category, language); // <-- PASS IT
    res.json({ script, articles });
  } catch (error) {
    console.error('Radio broadcast error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

// --- UPDATE THIS CONTROLLER ---
export const postRadioChat = async (req, res) => {
  try {
    const { userMessage, broadcastScript, chatHistory, language = 'en-US' } = req.body; // <-- GET LANGUAGE
    if (!userMessage || !broadcastScript || !chatHistory) {
      return res.status(400).json({ message: 'Missing message, script, or history' });
    }

    const response = await NewsService.getRadioChatResponse(userMessage, broadcastScript, chatHistory, language); // <-- PASS IT
    res.json({ role: 'assistant', content: response });
  } catch (error) {
    console.error('Radio chat error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getHeadlines = async (req, res) => {
  try {
    const { category = 'general', language = 'en' } = req.query;
    const articles = await NewsService.getHeadlines(category, language);
    // We mimic the GNews structure so the frontend doesn't break
    res.json({ articles, totalArticles: articles.length });
  } catch (error) {
    console.error('Error in /headlines:', error.message || error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch headlines.' });
  }
};
export const searchNews = async (req, res) => {
  try {
    // req.query will contain { keyword, date, country, etc. }
    const result = await NewsService.searchNews(req.query);
    res.json(result); // Sends back { articles, totalArticles }
  } catch (error) {
    console.error('Error in /search:', error.message || error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch search results.' });
  }
};
