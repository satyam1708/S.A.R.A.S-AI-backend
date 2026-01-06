import { AzureOpenAI } from "openai";
import logger from "../lib/logger.js";
import { withAIRetry, cleanAIJSON } from "../utils/aiUtils.js";
import { PROMPTS, PERSONA } from "../lib/prompts.js"; // Import Acharya Drona

// =========================================================
// 1. CONFIGURATION & CLIENT INITIALIZATION
// =========================================================

const {
  AZURE_OPENAI_KEY,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_CHAT_DEPLOYMENT,
  AZURE_OPENAI_EMBEDDING_ENDPOINT,
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
  AZURE_OPENAI_DALLE_ENDPOINT,
  AZURE_OPENAI_DALLE_DEPLOYMENT,
} = process.env;

let chatClient, embeddingClient, dalleClient;

// --- A. Chat Client ---
if (
  !AZURE_OPENAI_ENDPOINT ||
  !AZURE_OPENAI_KEY ||
  !AZURE_OPENAI_CHAT_DEPLOYMENT
) {
  logger.error("❌ Azure Chat Config Missing");
} else {
  chatClient = new AzureOpenAI({
    endpoint: AZURE_OPENAI_ENDPOINT,
    apiKey: AZURE_OPENAI_KEY,
    apiVersion: "2024-05-01-preview",
    deployment: AZURE_OPENAI_CHAT_DEPLOYMENT,
  });
}

// --- B. Embedding Client ---
if (
  !AZURE_OPENAI_EMBEDDING_ENDPOINT ||
  !AZURE_OPENAI_KEY ||
  !AZURE_OPENAI_EMBEDDING_DEPLOYMENT
) {
  logger.error("❌ Azure Embedding Config Missing");
} else {
  embeddingClient = new AzureOpenAI({
    endpoint: AZURE_OPENAI_EMBEDDING_ENDPOINT,
    apiKey: AZURE_OPENAI_KEY,
    apiVersion: "2024-05-01-preview",
    deployment: AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
  });
}

// --- C. DALL-E Client ---
if (AZURE_OPENAI_DALLE_ENDPOINT && AZURE_OPENAI_KEY) {
  dalleClient = new AzureOpenAI({
    endpoint: AZURE_OPENAI_DALLE_ENDPOINT,
    apiKey: AZURE_OPENAI_KEY,
    apiVersion: "2024-02-01",
    deployment: AZURE_OPENAI_DALLE_DEPLOYMENT,
  });
} else {
  logger.warn("⚠️ DALL-E Config Missing");
}

// =========================================================
// 2. HELPER: FALLBACK STREAM
// =========================================================

/**
 * Creates a mock stream to gracefully handle errors in the UI
 * without crashing the connection.
 */
async function* createFallbackStream(errorMessage) {
  const words = errorMessage.split(" ");
  for (const word of words) {
    yield {
      choices: [{ delta: { content: word + " " } }],
    };
    // Slight delay to simulate typing
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// =========================================================
// 3. CORE AI SERVICE FUNCTIONS
// =========================================================

export const generateQuizFromContent = async (context) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    { role: "system", content: PROMPTS.QUIZ_GENERATION.system },
    { role: "user", content: `CONTEXT:\n${context}` },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
    if (!parsed.quiz || !Array.isArray(parsed.quiz))
      throw new Error("Invalid quiz structure returned.");
    return parsed.quiz;
  });
};

export const summarizeArticle = async (articleContent) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    { role: "system", content: PROMPTS.NEWS_SUMMARY.system },
    { role: "user", content: articleContent },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_completion_tokens: 500,
    });
    return result.choices[0].message.content;
  });
};

export const getChatCompletion = async (messages) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  // Inject Persona if not present
  if (messages.length > 0 && messages[0].role !== "system") {
    messages.unshift({ role: "system", content: PERSONA.ACHARYA_DRONA });
  }

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_completion_tokens: 800,
    });
    return result.choices[0].message.content;
  });
};

/**
 * ROBUST STREAM HANDLING
 * Catches init errors and returns a polite fallback stream.
 */
export const getChatCompletionStream = async (messages) => {
  if (!chatClient) {
    logger.error("AI Client not ready for stream");
    return createFallbackStream(
      "System Error: AI services are currently initializing. Please try again momentarily."
    );
  }

  // Inject Persona
  if (messages.length > 0 && messages[0].role !== "system") {
    messages.unshift({ role: "system", content: PERSONA.ACHARYA_DRONA });
  }

  try {
    const stream = await chatClient.chat.completions.create({
      messages,
      max_completion_tokens: 1000,
      stream: true,
    });
    return stream;
  } catch (error) {
    logger.error(
      `Stream Init Failed (Graceful Fallback Triggered): ${error.message}`
    );

    // Return a safe, polite message stream so the UI doesn't crash
    return createFallbackStream(
      "Namaskar. High traffic is currently affecting my connection to the knowledge archives. Please wait a moment and ask again. (Service Busy)"
    );
  }
};

export const generateNewsBroadcast = async (
  articlesContent,
  category,
  messages,
  language = "en-US"
) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const persona =
    language === "hi-IN"
      ? PROMPTS.NEWS_BROADCAST_HI
      : PROMPTS.NEWS_BROADCAST_EN;

  const allMessages = [
    { role: "system", content: persona },
    ...messages,
    {
      role: "user",
      content: `Category: ${category}\nNews Content: ${articlesContent}`,
    },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages: allMessages,
      max_completion_tokens: 1500,
    });
    return result.choices[0].message.content;
  });
};

export const chunkContentForLearning = async (fullText) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    { role: "system", content: PROMPTS.CONTENT_CHUNKING.system },
    { role: "user", content: fullText },
  ];

  const rawBlocks = await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
    return parsed.blocks || [];
  });

  // Normalize blocks
  const normalized = [];
  for (let block of rawBlocks) {
    if (!block || typeof block !== "string") continue;
    block = block.trim();
    if (block.length < 30) continue;

    if (block.length > 900) {
      const parts = block.match(/.{1,700}(\s|$)/g) || [];
      normalized.push(...parts.map((p) => p.trim()));
    } else {
      normalized.push(block);
    }
  }
  return normalized;
};

export const generateFlashcardsFromContent = async (context) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    { role: "system", content: PROMPTS.FLASHCARDS.system },
    { role: "user", content: `CONTEXT:\n${context}` },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_completion_tokens: 2000,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
    return parsed.flashcards || [];
  });
};

export const getEmbedding = async (text) => {
  if (!embeddingClient) throw new Error("AI embedding client not initialized.");

  return await withAIRetry(async () => {
    const result = await embeddingClient.embeddings.create({ input: text });
    return result.data[0].embedding;
  });
};

export const parseQuestionsFromText = async (rawText, examSource) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    { role: "system", content: PROMPTS.EXTRACT_QUESTIONS.system },
    {
      role: "user",
      content: `Exam Source: ${examSource}\nText: ${rawText.substring(0, 12000)}`,
    },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
    return parsed.questions || [];
  });
};

export const generateCurrentAffairsQuestions = async (
  newsArticles,
  count = 5
) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const context = newsArticles
    .map((a) => `- ${a.title}: ${a.description}`)
    .join("\n");

  const messages = [
    { role: "system", content: PROMPTS.CURRENT_AFFAIRS.system },
    { role: "user", content: `News Context:\n${context}` },
  ];

  try {
    return await withAIRetry(async () => {
      const result = await chatClient.chat.completions.create({
        messages,
        max_completion_tokens: 3000,
        response_format: { type: "json_object" },
      });
      const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
      return parsed.questions || parsed.quiz || [];
    });
  } catch (error) {
    logger.error(`CA Gen Failed: ${error.message}`);
    return [];
  }
};

export const generateExamAnalysis = async (
  score,
  totalMarks,
  weakTopics,
  timeSpent
) => {
  if (!chatClient) return null;

  const messages = [
    { role: "system", content: PROMPTS.EXAM_ANALYSIS.system },
    {
      role: "user",
      content: `Score: ${score}/${totalMarks}, Weak Topics: ${weakTopics.join(",")}, Time: ${timeSpent}s`,
    },
  ];

  try {
    return await withAIRetry(async () => {
      const result = await chatClient.chat.completions.create({
        messages,
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
      });
      return JSON.parse(cleanAIJSON(result.choices[0].message.content));
    });
  } catch (error) {
    logger.error(`Analysis Gen Failed: ${error.message}`);
    return null;
  }
};

export const generateEnglishDose = async () => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    { role: "system", content: PROMPTS.ENGLISH_DOSE.system },
    { role: "user", content: "Generate today's English dose." },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_completion_tokens: 2500,
      response_format: { type: "json_object" },
    });
    return JSON.parse(cleanAIJSON(result.choices[0].message.content));
  });
};

export const generateEducationalImage = async (prompt) => {
  if (!dalleClient) throw new Error("DALL-E client not initialized.");

  return await withAIRetry(async () => {
    const result = await dalleClient.images.generate({
      model: AZURE_OPENAI_DALLE_DEPLOYMENT,
      prompt: `Educational illustration, detailed, realistic, clear: ${prompt}`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
    });
    return result.data[0].url;
  });
};

export const generateQuestionsFromSyllabus = async (
  courseName,
  subjectName,
  count = 5
) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    {
      role: "system",
      content: PROMPTS.SYLLABUS_QUESTIONS.system(
        subjectName,
        courseName,
        count
      ),
    },
    { role: "user", content: "Generate questions." },
  ];

  try {
    return await withAIRetry(async () => {
      const result = await chatClient.chat.completions.create({
        messages,
        max_completion_tokens: 3500,
        response_format: { type: "json_object" },
      });
      const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
      return parsed.questions || [];
    });
  } catch (error) {
    logger.error(`Syllabus Gen Failed for ${subjectName}: ${error.message}`);
    return [];
  }
};
