// src/modules/news/news.controller.js
import axios from "axios";
import axiosRetry from "axios-retry";
import * as NewsService from "./news.service.js";
import { getChatCompletionStream } from "../../services/aiService.js";
import logger from "../../lib/logger.js"; // Enterprise Logger

const API_KEY = process.env.GNEWS_API_KEY;

if (!API_KEY) {
  logger.error("❌ FATAL: GNEWS_API_KEY is not set!");
  process.exit(1);
}

// Setup axios retry globally for resilience
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) ||
    err.code === "ETIMEDOUT",
});

export const pingGNews = async (req, res) => {
  try {
    await axios.get("https://gnews.io");
    res.status(200).json({ success: true, message: "GNews API reachable" });
  } catch (error) {
    logger.error(`Ping Failed: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getNews = async (req, res) => {
  try {
    // Legacy route support
    const params = await NewsService.buildGNewsParams(req.query);
    const url = new URL(
      req.query.mode === "top-headlines"
        ? "https://gnews.io/api/v4/top-headlines"
        : "https://gnews.io/api/v4/search"
    );
    const response = await axios.get(url.toString(), {
      params,
      timeout: 15000,
    });
    res.json(response.data);
  } catch (error) {
    logger.error(`Legacy News API Error: ${error.message}`);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
};

export const proxyImage = async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send("Missing image URL");
    
    // Stream image to client to avoid memory buffering
    const response = await axios.get(imageUrl, { responseType: "stream" });
    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    response.data.pipe(res);
  } catch (error) {
    logger.warn(`Image Proxy Failed for ${req.query.url}`);
    res.status(500).send("Failed to fetch image");
  }
};

export const summarize = async (req, res) => {
  try {
    const { content } = req.body;
    const summary = await NewsService.getSummary(content);
    res.json({ summary });
  } catch (error) {
    logger.error(`Summarize Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const getRadioBroadcast = async (req, res) => {
  try {
    const { category, language } = req.body;
    const { script, articles } = await NewsService.getRadioBroadcast(
      category,
      language
    );
    res.json({ script, articles });
  } catch (error) {
    logger.error(`Radio Broadcast Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const postRadioChat = async (req, res) => {
  try {
    const { userMessage, broadcastScript, chatHistory, language } = req.body;
    
    const response = await NewsService.getRadioBroadcastResponse(
      userMessage,
      broadcastScript,
      chatHistory,
      language
    );
    res.json({ role: "assistant", content: response });
  } catch (error) {
    logger.error(`Radio Chat Failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

/**
 * --- OPTIMIZED STREAMING CONTROLLER ---
 */
export const postRadioChatStream = async (req, res) => {
  try {
    const { userMessage, broadcastScript, chatHistory, language } = req.body;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    const context = `Here is the full broadcast script I am reading from:\n${broadcastScript}\n\nAnswer the user's question briefly and conversationally based on this.`;

    const messages = [
      {
        role: "system",
        content: `You are a professional news anchor. ${language === "hi-IN" ? "Speak in Hinglish." : "Speak in English."} Keep answers short (1-2 sentences). Context:\n${context}`,
      },
      ...(chatHistory || []),
      { role: "user", content: userMessage },
    ];

    try {
      const stream = await getChatCompletionStream(messages);

      for await (const chunk of stream) {
        if (res.writableEnded || res.closed) break;
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    } catch (streamError) {
      logger.error(`Stream Gen Error: ${streamError.message}`);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ content: " [Connection Error]" })}\n\n`);
      }
    }

    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }

  } catch (error) {
    logger.error(`Radio Stream Controller Error: ${error.message}`);
    if (!res.headersSent) res.status(500).json({ message: error.message });
    else if (!res.writableEnded) res.end();
  }
};

export const getHeadlines = async (req, res) => {
  try {
    const { category, language } = req.query;
    const articles = await NewsService.getHeadlines(category, language);
    res.json({ articles, totalArticles: articles.length });
  } catch (error) {
    logger.error(`Get Headlines Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const searchNews = async (req, res) => {
  try {
    const result = await NewsService.searchNews(req.query);
    res.json(result);
  } catch (error) {
    logger.error(`Search News Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};