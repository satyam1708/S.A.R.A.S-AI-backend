// src/modules/news/news.controller.js
import axios from "axios";
import axiosRetry from "axios-retry";
import * as NewsService from "./news.service.js";
import { getChatCompletionStream } from "../../services/aiService.js";

const API_KEY = process.env.GNEWS_API_KEY;

if (!API_KEY) {
  console.error("❌ ERROR: GNEWS_API_KEY is not set in environment variables!");
  process.exit(1);
}

// Setup axios retry
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) ||
    err.code === "ETIMEDOUT",
});

// ... (Keep pingGNews, getNews, proxyImage, summarize, getRadioBroadcast) ...
// [Standard handlers remain unchanged]
export const pingGNews = async (req, res) => {
  try {
    await axios.get("https://gnews.io");
    res.status(200).json({ success: true, message: "GNews API reachable" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getNews = async (req, res) => {
  try {
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
    console.error("Error in /api/news:", error.message);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const proxyImage = async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send("Missing image URL");
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.send(response.data);
  } catch (error) {
    res.status(500).send("Failed to fetch image");
  }
};

export const summarize = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content)
      return res.status(400).json({ message: "Article content is required" });
    const summary = await NewsService.getSummary(content);
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRadioBroadcast = async (req, res) => {
  try {
    const { category = "general", language = "en-US" } = req.body;
    const { script, articles } = await NewsService.getRadioBroadcast(
      category,
      language
    );
    res.json({ script, articles });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const postRadioChat = async (req, res) => {
  try {
    const {
      userMessage,
      broadcastScript,
      chatHistory,
      language = "en-US",
    } = req.body;
    if (!userMessage)
      return res.status(400).json({ message: "Missing message" });
    const response = await NewsService.getRadioBroadcastResponse(
      userMessage,
      broadcastScript,
      chatHistory,
      language
    );
    res.json({ role: "assistant", content: response });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * --- OPTIMIZED STREAMING CONTROLLER ---
 */
export const postRadioChatStream = async (req, res) => {
  try {
    const {
      userMessage,
      broadcastScript,
      chatHistory,
      language = "en-US",
    } = req.body;

    if (!userMessage) {
      return res.status(400).json({ message: "Message required" });
    }

    // 1. Set SSE Headers properly
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    // 2. Prepare Context
    const context = `Here is the full broadcast script I am reading from:\n${broadcastScript}\n\nAnswer the user's question briefly and conversationally based on this.`;

    const messages = [
      {
        role: "system",
        content: `You are a professional news anchor. ${language === "hi-IN" ? "Speak in Hinglish." : "Speak in English."} Keep answers short (1-2 sentences) for a voice conversation. Context:\n${context}`,
      },
      ...(chatHistory || []),
      { role: "user", content: userMessage },
    ];

    // 3. Start Stream
    try {
      const stream = await getChatCompletionStream(messages);

      for await (const chunk of stream) {
        // Check if the client has disconnected
        if (res.writableEnded || res.closed) break; 

        const content = chunk.choices[0]?.delta?.content || "";
        
        if (content) {
          // Write the data ensuring it ends with double newline
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
          
          // Optional: Flush if your environment requires it (not needed for standard Express)
          // if (res.flush) res.flush(); 
        }
      }
    } catch (streamError) {
      console.error("Stream Generation Error:", streamError);
      // If the stream crashes mid-way, try to tell the client
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ content: " [Connection Error]" })}\n\n`);
      }
    }

    // 4. Clean Termination
    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }

  } catch (error) {
    console.error("Controller Error:", error);
    // Only send JSON error if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
};

export const getHeadlines = async (req, res) => {
  try {
    const { category = "general", language = "en" } = req.query;
    const articles = await NewsService.getHeadlines(category, language);
    res.json({ articles, totalArticles: articles.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const searchNews = async (req, res) => {
  try {
    const result = await NewsService.searchNews(req.query);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
