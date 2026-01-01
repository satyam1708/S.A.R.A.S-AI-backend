import { AzureOpenAI } from "openai";
import logger from "../lib/logger.js";
import { withAIRetry, cleanAIJSON } from "../utils/aiUtils.js";

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

// Initialize Clients
let chatClient, embeddingClient, dalleClient;

// A. Chat Client
if (
  !AZURE_OPENAI_ENDPOINT ||
  !AZURE_OPENAI_KEY ||
  !AZURE_OPENAI_CHAT_DEPLOYMENT
) {
  logger.error(
    "❌ Azure Chat Config Missing (ENDPOINT, KEY, or CHAT_DEPLOYMENT)"
  );
} else {
  chatClient = new AzureOpenAI({
    endpoint: AZURE_OPENAI_ENDPOINT,
    apiKey: AZURE_OPENAI_KEY,
    apiVersion: "2024-05-01-preview",
    deployment: AZURE_OPENAI_CHAT_DEPLOYMENT,
  });
}

// B. Embedding Client
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

// C. DALL-E Client
if (AZURE_OPENAI_DALLE_ENDPOINT && AZURE_OPENAI_KEY) {
  dalleClient = new AzureOpenAI({
    endpoint: AZURE_OPENAI_DALLE_ENDPOINT,
    apiKey: AZURE_OPENAI_KEY,
    apiVersion: "2024-02-01",
    deployment: AZURE_OPENAI_DALLE_DEPLOYMENT,
  });
} else {
  logger.warn("⚠️ DALL-E Config Missing. Image generation will fail.");
}

// =========================================================
// 2. CORE AI SERVICE FUNCTIONS
// =========================================================

/**
 * Generates a 10-question MCQ quiz from provided context.
 * Enforces strict JSON output.
 */
export const generateQuizFromContent = async (context) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    {
      role: "system",
      content: `You are an expert quiz creator for Indian government exams.
      task: Generate 10 high-quality MCQs based on the provided context.
      format: JSON Object ONLY. No markdown.
      schema: { "quiz": [{ "questionText": "...", "options": ["A","B","C","D"], "correctAnswerIndex": 0 }] }`,
    },
    { role: "user", content: `CONTEXT:\n${context}` },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
    if (!parsed.quiz || !Array.isArray(parsed.quiz))
      throw new Error("Invalid quiz structure returned.");
    return parsed.quiz;
  });
};

/**
 * Summarizes text for exam preparation.
 */
export const summarizeArticle = async (articleContent) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    {
      role: "system",
      content:
        "You are an expert news analyst for UPSC/SSC aspirants. Summarize the article into 3-4 bullet points focusing on facts, figures, and policy implications. Tone: Formal & Academic.",
    },
    { role: "user", content: articleContent },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_tokens: 300,
    });
    return result.choices[0].message.content;
  });
};

/**
 * Standard Chat Completion with Retry
 */
export const getChatCompletion = async (messages) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_tokens: 500,
      temperature: 0.3,
    });
    return result.choices[0].message.content;
  });
};

/**
 * Chat Stream (Note: Streams are harder to retry mid-flight,
 * but we retry the initial connection).
 */
export const getChatCompletionStream = async (messages) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  try {
    return await chatClient.chat.completions.create({
      messages,
      max_tokens: 800,
      temperature: 0.3,
      stream: true,
    });
  } catch (error) {
    logger.error(`Stream Init Failed: ${error.message}`);
    throw error;
  }
};

/**
 * Generates a News Broadcast script based on Persona & Language
 */
export const generateNewsBroadcast = async (
  articlesContent,
  category,
  messages,
  language = "en-US"
) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const persona =
    language === "hi-IN"
      ? `You are a formal news anchor for 'SarvaGyaan' (Hinglish). Start: "Namaskar vidyarthiyon...". End: "Dhanyavaad". Concise summaries.`
      : `You are a professional news anchor for 'SarvaGyaan'. Start: "Welcome...". End: "Thank you". Concise summaries.`;

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
      max_tokens: 1500,
    });
    return result.choices[0].message.content;
  });
};

/**
 * Chunks text into learning blocks.
 * Robust post-processing included.
 */
export const chunkContentForLearning = async (fullText) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    {
      role: "system",
      content: `Split text into logical learning blocks (250-800 chars).
      output: STRICT JSON.
      schema: { "blocks": ["string1", "string2"] }`,
    },
    { role: "user", content: fullText },
  ];

  const rawBlocks = await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_tokens: 4000,
      temperature: 0,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
    if (!parsed.blocks || !Array.isArray(parsed.blocks))
      throw new Error("Invalid blocks format.");
    return parsed.blocks;
  });

  // Post-Processing for consistent size
  const normalized = [];
  for (let block of rawBlocks) {
    if (!block || typeof block !== "string") continue;
    block = block.trim();
    if (block.length < 30 || !isNaN(Number(block))) continue;

    if (block.length > 900) {
      const parts = block.match(/.{1,700}(\s|$)/g) || [];
      normalized.push(...parts.map((p) => p.trim()));
    } else if (block.length < 200 && normalized.length > 0) {
      normalized[normalized.length - 1] += " " + block;
    } else {
      normalized.push(block);
    }
  }
  return normalized;
};

/**
 * Generates Flashcards (Q&A Pairs)
 */
export const generateFlashcardsFromContent = async (context) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    {
      role: "system",
      content: `Generate 5-10 factual flashcards for exam study.
      format: JSON Object.
      schema: { "flashcards": [{ "question": "...", "answer": "..." }] }`,
    },
    { role: "user", content: `CONTEXT:\n${context}` },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
    return parsed.flashcards || [];
  });
};

/**
 * Generates Embeddings (Vectors)
 */
export const getEmbedding = async (text) => {
  if (!embeddingClient) throw new Error("AI embedding client not initialized.");

  return await withAIRetry(async () => {
    const result = await embeddingClient.embeddings.create({ input: text });
    return result.data[0].embedding;
  });
};

/**
 * Extracts questions from unstructured text (PDF/Docs)
 */
export const parseQuestionsFromText = async (rawText, examSource) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    {
      role: "system",
      content: `Extract MCQs from text. If answer is not marked, SOLVE it.
      Assign 'subject' and 'difficulty' (EASY/MEDIUM/HARD).
      format: JSON Object.
      schema: { "questions": [{ "questionText": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "subject": "...", "difficulty": "MEDIUM" }] }`,
    },
    {
      role: "user",
      content: `Exam Source: ${examSource}\nText: ${rawText.substring(0, 12000)}`,
    },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
    return parsed.questions || [];
  });
};

/**
 * Generates General Awareness Questions from News
 */
export const generateCurrentAffairsQuestions = async (
  newsArticles,
  count = 5
) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const context = newsArticles
    .map((a) => `- ${a.title}: ${a.description}`)
    .join("\n");

  const messages = [
    {
      role: "system",
      content: `Generate ${count} MCQs based STRICTLY on the news provided.
      Focus: Appointments, Awards, Schemes, Sports.
      format: JSON Object.
      schema: { "questions": [{ "questionText": "...", "options": [], "correctIndex": 0, "explanation": "..." }] }`,
    },
    { role: "user", content: `News Context:\n${context}` },
  ];

  try {
    return await withAIRetry(async () => {
      const result = await chatClient.chat.completions.create({
        messages,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      });
      const parsed = JSON.parse(cleanAIJSON(result.choices[0].message.content));
      return parsed.questions || parsed.quiz || [];
    });
  } catch (error) {
    logger.error(`CA Gen Failed: ${error.message}`);
    return []; // Return empty array so the main process doesn't crash
  }
};

/**
 * Generates Post-Exam Analysis
 */
export const generateExamAnalysis = async (
  score,
  totalMarks,
  weakTopics,
  timeSpent
) => {
  if (!chatClient) return null;

  const messages = [
    {
      role: "system",
      content: `Analyze student performance.
      schema: { "summary": "...", "strengths": [], "weaknesses": [], "actionPlan": "..." }`,
    },
    {
      role: "user",
      content: `Score: ${score}/${totalMarks}, Weak Topics: ${weakTopics.join(",")}, Time: ${timeSpent}s`,
    },
  ];

  try {
    return await withAIRetry(async () => {
      const result = await chatClient.chat.completions.create({
        messages,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      });
      return JSON.parse(cleanAIJSON(result.choices[0].message.content));
    });
  } catch (error) {
    logger.error(`Analysis Gen Failed: ${error.message}`);
    return null;
  }
};

/**
 * Generates Daily English Dose
 */
export const generateEnglishDose = async () => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    {
      role: "system",
      content: `Generate English Learning content.
      schema: { 
        "vocabulary": [{ "word": "...", "meaning": "...", "synonyms": [], "antonyms": [], "sentence": "..." }],
        "idiom": { "phrase": "...", "meaning": "...", "sentence": "..." },
        "grammar": { "title": "...", "rule": "...", "example": "..." },
        "root": { "word": "...", "meaning": "...", "examples": [] },
        "quiz": { "question": "...", "options": [], "correctIndex": 0, "explanation": "..." }
      }`,
    },
    { role: "user", content: "Generate today's English dose." },
  ];

  return await withAIRetry(async () => {
    const result = await chatClient.chat.completions.create({
      messages,
      max_tokens: 2500,
      response_format: { type: "json_object" },
    });
    return JSON.parse(cleanAIJSON(result.choices[0].message.content));
  });
};

/**
 * Generates Educational Images (DALL-E)
 */
export const generateEducationalImage = async (prompt) => {
  if (!dalleClient) throw new Error("DALL-E client not initialized.");

  // Image gen usually doesn't throw 429 as often, but safe to wrap
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

/**
 * Generates Questions specifically based on Syllabus/Course Name
 */
export const generateQuestionsFromSyllabus = async (
  courseName,
  subjectName,
  count = 5
) => {
  if (!chatClient) throw new Error("AI chat client not initialized.");

  const messages = [
    {
      role: "system",
      content: `Generate ${count} MCQs for ${subjectName} (${courseName}).
      Difficulty: Mixed (Easy/Medium/Hard).
      schema: { "questions": [{ "questionText": "...", "options": [], "correctIndex": 0, "explanation": "...", "difficulty": "MEDIUM" }] }`,
    },
    { role: "user", content: "Generate questions." },
  ];

  try {
    return await withAIRetry(async () => {
      const result = await chatClient.chat.completions.create({
        messages,
        max_tokens: 3500,
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
