import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as NewsService from './news.service.js';
import { getChatCompletionStream } from '../../services/aiService.js'; // <--- IMPORT THIS

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
    const { category = 'general', language = 'en-US' } = req.body;
    const { script, articles } = await NewsService.getRadioBroadcast(category, language);
    res.json({ script, articles });
  } catch (error) {
    console.error('Radio broadcast error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

// Standard Chat (Legacy/Fallback)
export const postRadioChat = async (req, res) => {
  try {
    const { userMessage, broadcastScript, chatHistory, language = 'en-US' } = req.body;
    if (!userMessage || !broadcastScript || !chatHistory) {
      return res.status(400).json({ message: 'Missing message, script, or history' });
    }

    const response = await NewsService.getRadioBroadcastResponse(userMessage, broadcastScript, chatHistory, language);
    res.json({ role: 'assistant', content: response });
  } catch (error) {
    console.error('Radio chat error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

/**
 * --- NEW STREAMING CONTROLLER FOR VAPI-LIKE LATENCY ---
 * This establishes a Server-Sent Events (SSE) connection to stream
 * the AI response token-by-token to the frontend.
 */
export const postRadioChatStream = async (req, res) => {
  try {
    const { userMessage, broadcastScript, chatHistory, language = 'en-US' } = req.body;

    if (!userMessage) {
      return res.status(400).json({ message: 'Message required' });
    }

    // 1. Set headers for Server-Sent Events (SSE)
    // These headers keep the connection open and tell the browser it's a stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 2. Prepare Context for the AI
    // We inject the broadcast script so the AI knows what "context" it is discussing
    const context = `Here is the full broadcast script I am reading from:\n${broadcastScript}\n\nAnswer the user's question briefly and conversationally based on this.`;
    
    // 3. Prepare Messages Array
    const messages = [
      { 
        role: "system", 
        content: `You are a professional news anchor. ${language === 'hi-IN' ? 'Speak in Hinglish.' : 'Speak in English.'} Keep answers short (1-2 sentences) for a voice conversation. Context:\n${context}` 
      },
      ...(chatHistory || []),
      { role: "user", content: userMessage }
    ];

    // 4. Get Stream from AI Service
    const stream = await getChatCompletionStream(messages);

    // 5. Pipe Stream to Client
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        // Send data in SSE format: "data: {JSON}\n\n"
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // 6. End Stream
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Radio Stream Error:', error);
    // If headers aren't sent yet, send JSON error. 
    // If headers ARE sent, we must end the stream to stop the client from waiting.
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    } else {
      res.end();
    }
  }
};

export const getHeadlines = async (req, res) => {
  try {
    const { category = 'general', language = 'en' } = req.query;
    const articles = await NewsService.getHeadlines(category, language);
    res.json({ articles, totalArticles: articles.length });
  } catch (error) {
    console.error('Error in /headlines:', error.message || error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch headlines.' });
  }
};

export const searchNews = async (req, res) => {
  try {
    const result = await NewsService.searchNews(req.query);
    res.json(result);
  } catch (error) {
    console.error('Error in /search:', error.message || error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch search results.' });
  }
};