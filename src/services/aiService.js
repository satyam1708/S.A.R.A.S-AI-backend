// aiService.js
import { AzureOpenAI } from "openai";

// Get credentials from environment
const azureApiKey = process.env.AZURE_OPENAI_KEY;

// Chat client variables
const chatEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const chatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT;

// Embedding client variables
const embeddingEndpoint = process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT;
const embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;

let chatClient;
let embeddingClient;

// --- Initialize Chat Client ---
if (!chatEndpoint || !azureApiKey || !chatDeployment) {
  console.error(
    "❌ ERROR: Azure OpenAI Chat environment variables (ENDPOINT, KEY, CHAT_DEPLOYMENT) are not set."
  );
} else {
  chatClient = new AzureOpenAI({
    endpoint: chatEndpoint, // <-- Use Chat Endpoint
    apiKey: azureApiKey,
    apiVersion: "2024-05-01-preview",
    deployment: chatDeployment, // This is the deployment name for THIS client
  });
}

// --- Initialize Embedding Client ---
if (!embeddingEndpoint || !azureApiKey || !embeddingDeployment) {
  console.error(
    "❌ ERROR: Azure OpenAI Embedding environment variables (EMBEDDING_ENDPOINT, KEY, EMBEDDING_DEPLOYMENT) are not set."
  );
} else {
  embeddingClient = new AzureOpenAI({
    endpoint: embeddingEndpoint, // <-- Use Embedding Endpoint
    apiKey: azureApiKey,
    apiVersion: "2024-05-01-preview",
    deployment: embeddingDeployment, // This is the deployment name for THIS client
  });
}

/**
 * [NEW] Generates a 10-question MCQ quiz from provided content.
 */
export const generateQuizFromContent = async (context) => {
  if (!chatClient) {
    // <-- Check for chatClient
    throw new Error("AI chat client is not initialized.");
  }

  const messages = [
    {
      role: "system",
      content: `You are an expert quiz creator for Indian government exams (UPSC, SSC, UP POLICE).
Based ONLY on the CONTEXT provided, generate 10 high-quality Multiple Choice Questions (MCQs).
Each question must have exactly 4 options.
The entire response must be a single, valid JSON object in the following format:
{
  "quiz": [
    {
      "questionText": "What is the capital of France?",
      "options": ["Berlin", "Madrid", "Paris", "Rome"],
      "correctAnswerIndex": 2
    },
    ... 10 questions total ...
  ]
}
Do not include any text, markdown, or explanation outside of this single JSON object.`,
    },
    {
      role: "user",
      content: `CONTEXT:
---
${context}
---`,
    },
  ];

  try {
    // Use chatClient. No 'deployment' param needed.
    const result = await chatClient.chat.completions.create({
      messages: messages,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const jsonString = result.choices[0].message.content;

    const parsed = JSON.parse(jsonString);
    if (!parsed.quiz || !Array.isArray(parsed.quiz)) {
      throw new Error("AI returned invalid quiz format.");
    }

    return parsed.quiz;
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to get AI-generated quiz.");
  }
};

export const summarizeArticle = async (articleContent) => {
  if (!chatClient) {
    // <-- Check for chatClient
    throw new Error(
      "AI chat client is not initialized. Check server logs for errors."
    );
  }

  const messages = [
    {
      role: "system",
      content:
        "You are an expert news analyst for government exam (UPSC, SSC) aspirants. Summarize the article into 3-4 bullet points, focusing on facts, figures, locations, and policy implications relevant to these exams. Be objective and formal.",
    },
    { role: "user", content: articleContent },
  ];

  try {
    // Use chatClient
    const result = await chatClient.chat.completions.create({
      messages: messages,
      max_tokens: 200,
    });

    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error summarizing article:", error);
    throw new Error("Failed to get AI summary.");
  }
};

export const getChatCompletion = async (messages) => {
  if (!chatClient) {
    // <-- Check for chatClient
    throw new Error("AI chat client is not initialized.");
  }

  try {
    // Use chatClient
    const result = await chatClient.chat.completions.create({
      messages: messages,
      max_tokens: 1000,
    });
    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error in getChatCompletion:", error);
    throw new Error("Failed to get AI chat completion.");
  }
};

export const getChatCompletionStream = async (messages) => {
  if (!chatClient) {
    // <-- Check for chatClient
    throw new Error("AI chat client is not initialized.");
  }

  try {
    // Use chatClient
    const result = await chatClient.chat.completions.create({
      messages: messages,
      max_tokens: 1000,
      stream: true,
    });
    return result;
  } catch (error) {
    console.error("Error in getChatCompletionStream:", error);
    throw new Error("Failed to get AI chat stream.");
  }
};

export const generateNewsBroadcast = async (
  articlesContent,
  category,
  messages,
  language = "en-US"
) => {
  if (!chatClient) {
    // <-- Check for chatClient
    throw new Error("AI chat client is not initialized.");
  }

  let persona;
  if (language === "hi-IN") {
    persona = `You are a formal news anchor for 'SarvaGyaan', an exam preparation platform. You are delivering the daily 'Current Affairs' briefing in Hinglish.

    Aapke rules:
    1.  Start with: "Namaskar vidyarthiyon, SarvaGyaan Current Affairs mein aapka swagat hai."
    2.  Present each news item formally. "Aaj ki pehli khabar..."
    3.  For each article, provide a 2-3 sentence summary focused on facts relevant for exams (UPSC, SSC).
    4.  Aapka tone professional aur academic hai.
    5.  End with: "Yeh thi aaj ki mukhya khabrein. Dhanyavaad."

    CONTEXT:
    Aap '${category}' category ke liye briefing de rahe hain. Articles yeh hain:
    ${articlesContent}`;
  } else {
    // Default English persona
    persona = `You are a professional news anchor for 'SarvaGyaan', an exam preparation platform. You are delivering the daily 'Current Affairs' briefing.

    You must follow these rules:
    1.  Start with: "Welcome to the SarvaGyaan Current Affairs briefing."
    2.  Transition formally: "Our first headline...", "Moving on..."
    3.  For each article, provide a 2-3 sentence summary focused on facts relevant for government exams (UPSC, SSC).
    4.  Your tone is professional, objective, and academic.
    5.  End with: "This concludes the daily briefing. Thank you."

    CONTEXT:
    You are generating a broadcast for the '${category}' category. Here are the articles:
    ${articlesContent}`;
  }

  const allMessages = [{ role: "system", content: persona }, ...messages];

  try {
    // Use chatClient
    const result = await chatClient.chat.completions.create({
      messages: allMessages,
      max_tokens: 1500,
    });
    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error in generateNewsBroadcast:", error);
    throw new Error("Failed to get AI broadcast.");
  }
};
export const chunkContentForLearning = async (fullText) => {
  if (!chatClient) throw new Error("AI chat client is not initialized.");

  const messages = [
    {
      role: "system",
      content: `
You split the provided text into meaningful learning blocks.

BLOCK RULES:
1. Each block should be 2–5 sentences.
2. Blocks must be at least 250 characters.
3. Blocks must NOT exceed 800 characters.
4. Split only when the topic logically shifts.
5. NEVER return numeric chunks, timestamps, or garbage values.

Output must be STRICT JSON:
{
  "blocks": ["block1", "block2", ...]
}
`,
    },
    {
      role: "user",
      content: fullText,
    },
  ];

  try {
    const result = await chatClient.chat.completions.create({
      messages,
      max_tokens: 4000,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const jsonString = result.choices[0].message.content;
    console.log("AI chunk response:", jsonString);

    if (!jsonString) throw new Error("Empty AI response.");

    let { blocks } = JSON.parse(jsonString);

    if (!blocks || !Array.isArray(blocks)) {
      throw new Error("Invalid block format.");
    }

    // ----------------------------------------
    // ⭐ POST-PROCESSING: SIZE NORMALIZATION ⭐
    // ----------------------------------------

    const normalized = [];

    for (let block of blocks) {
      if (!block || typeof block !== "string") continue;
      block = block.trim();

      // Skip if it's just a number or too tiny
      if (block.length < 30 || !isNaN(Number(block))) continue;

      // If block is too long → split
      if (block.length > 900) {
        let parts = block.match(/.{1,700}(\s|$)/g); // split by ~700 chars
        normalized.push(...parts.map((p) => p.trim()));
      }
      // If block is too short → merge with previous
      else if (block.length < 200 && normalized.length > 0) {
        normalized[normalized.length - 1] += " " + block;
      } else {
        normalized.push(block);
      }
    }

    return normalized;
  } catch (error) {
    console.error("Error chunking content:", error);
    throw new Error("Failed to generate content blocks.");
  }
};

export const generateFlashcardsFromContent = async (context) => {
  if (!chatClient) {
    // <-- Check for chatClient
    throw new Error("AI chat client is not initialized.");
  }

  const messages = [
    {
      role: "system",
      content: `You are an expert study assistant for Indian government exams (UPSC, SSC).
Based ONLY on the CONTEXT provided, generate 5-10 simple, factual "question and answer" pairs for flashcards.
Questions should be simple (e.g., "What is X?", "When did Y happen?").
Answers should be concise and directly answer the question.
The entire response must be a single, valid JSON object in the following format:
{
  "flashcards": [
    {
      "question": "What is the capital of France?",
      "answer": "Paris."
    },
    ... 5-10 flashcards total ...
  ]
}
Do not include any text, markdown, or explanation outside of this single JSON object.`,
    },
    {
      role: "user",
      content: `CONTEXT:
---
${context}
---`,
    },
  ];

  try {
    // Use chatClient
    const result = await chatClient.chat.completions.create({
      messages: messages,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const jsonString = result.choices[0].message.content;
    const parsed = JSON.parse(jsonString);

    if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
      throw new Error("AI returned invalid flashcard format.");
    }

    return parsed.flashcards;
  } catch (error) {
    console.error("Error generating flashcards:", error);
    throw new Error("Failed to get AI-generated flashcards.");
  }
};

// --- THIS IS THE FIXED EMBEDDING FUNCTION ---
export const getEmbedding = async (text) => {
  if (!embeddingClient) {
    // <-- Check for embeddingClient
    throw new Error("AI embedding client is not initialized.");
  }
  try {
    // Use embeddingClient. No 'deployment' param needed.
    const result = await embeddingClient.embeddings.create({
      input: text,
    });
    return result.data[0].embedding; // Returns the vector array
  } catch (error) {
    console.error("Error getting embedding:", error);
    throw new Error("Failed to get AI embedding.");
  }
};
