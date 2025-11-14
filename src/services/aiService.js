// aiService.js
import { AzureOpenAI } from 'openai'; // <-- CORRECTED IMPORT

// Get credentials from environment
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_KEY;
// This is the DEPLOYMENT NAME for your chat model (gpt-4o-mini)
const chatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT; 
const embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;

let client;

if (!endpoint || !azureApiKey || !chatDeployment || !embeddingDeployment) {
  console.error("❌ ERROR: Azure OpenAI environment variables (ENDPOINT, KEY, CHAT_DEPLOYMENT) are not set.");
} else {
  // CORRECTED Client Initialization based on your example
  client = new AzureOpenAI({
    endpoint,
    apiKey: azureApiKey,
    // This api-version is standard, but you can change if yours is different
    apiVersion: "2024-05-01-preview", 
    // The deployment name is passed as a default here
    chatDeployment, 
  });
}

/**
 * [NEW] Generates a 10-question MCQ quiz from provided content.
 */
export const generateQuizFromContent = async (context) => {
  if (!client) {
    throw new Error("AI client is not initialized.");
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
---`
    }
  ];

  try {
    const result = await client.chat.completions.create({
      deployment: chatDeployment,
      messages: messages,
      max_tokens: 4000, // Increase token limit to ensure 10 questions can fit
      response_format: { type: "json_object" }, // Use explicit JSON mode
    });
    
    const jsonString = result.choices[0].message.content;
    
    // Parse the JSON and return the array of questions
    const parsed = JSON.parse(jsonString);
    if (!parsed.quiz || !Array.isArray(parsed.quiz)) {
      throw new Error("AI returned invalid quiz format.");
    }
    
    return parsed.quiz; // Returns the array of question objects

  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to get AI-generated quiz.");
  }
};


export const summarizeArticle = async (articleContent) => {
  if (!client) {
    throw new Error("AI client is not initialized. Check server logs for errors.");
  }

  // --- NEW EXAM-FOCUSED PERSONA ---
  const messages = [
    { role: "system", content: "You are an expert news analyst for government exam (UPSC, SSC) aspirants. Summarize the article into 3-4 bullet points, focusing on facts, figures, locations, and policy implications relevant to these exams. Be objective and formal." },
    { role: "user", content: articleContent },
  ];

  try {
    // CORRECTED API Call (using .create)
    // We don't need to pass the deployment name here since it was set in the client
    const result = await client.chat.completions.create({
      deployment: chatDeployment,
      messages: messages,
      max_tokens: 200, // Increased max tokens for better summaries
    });

    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error summarizing article:", error);
    throw new Error("Failed to get AI summary.");
  }
};


// --- NEW FUNCTION for the GS Tutor ---
export const getChatCompletion = async (messages) => {
  if (!client) {
    throw new Error("AI client is not initialized.");
  }

  try {
    const result = await client.chat.completions.create({
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
  if (!client) {
    throw new Error("AI client is not initialized.");
  }

  try {
    const result = await client.chat.completions.create({
      messages: messages,
      max_tokens: 1000,
      stream: true, // <-- This is the magic flag!
    });
    return result; // Return the stream iterator
  } catch (error) {
    console.error("Error in getChatCompletionStream:", error);
    throw new Error("Failed to get AI chat stream.");
  }
};


export const generateNewsBroadcast = async (articlesContent, category, messages, language = 'en-US') => {
  if (!client) {
    throw new Error("AI client is not initialized.");
  }

  // --- NEW EXAM-FOCUSED PERSONA (REPLACED AI-JAY) ---
  let persona;
  if (language === 'hi-IN') {
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
  // --- END of new persona logic ---

  const allMessages = [
    { role: "system", content: persona },
    ...messages,
  ];

  try {
    const result = await client.chat.completions.create({
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
  if (!client) {
    throw new Error("AI client is not initialized.");
  }

  const messages = [
    {
      role: "system",
      content: `You are an AI text processor. Your job is to parse a large document and split it into an array of small, self-contained "Content Blocks" for a learning system.
Each block should be a single paragraph, definition, or a few related sentences.
The response must be a single, valid JSON object in the format:
{
  "blocks": [
    "This is the first logical chunk of text.",
    "This is the second, separate concept from the text.",
    "This is a third piece of information."
  ]
}
Do not include any text, markdown, or explanation outside of this single JSON object.`,
    },
    {
      role: "user",
      content: `Here is the full text to process:
---
${fullText}
---`
    }
  ];

  try {
    const result = await client.chat.completions.create({
      messages: messages,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });
    
    const jsonString = result.choices[0].message.content;
    const parsed = JSON.parse(jsonString);
    
    if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
      throw new Error("AI returned invalid block format.");
    }
    
    return parsed.blocks; // Returns the array of content strings

  } catch (error) {
    console.error("Error chunking content:", error);
    throw new Error("Failed to get AI-generated content blocks.");
  }
};

export const generateFlashcardsFromContent = async (context) => {
  if (!client) {
    throw new Error("AI client is not initialized.");
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
---`
    }
  ];

  try {
    const result = await client.chat.completions.create({
      messages: messages,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });
    
    const jsonString = result.choices[0].message.content;
    const parsed = JSON.parse(jsonString);
    
    if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
      throw new Error("AI returned invalid flashcard format.");
    }
    
    return parsed.flashcards; // Returns the array of { question, answer } objects

  } catch (error) {
    console.error("Error generating flashcards:", error);
    throw new Error("Failed to get AI-generated flashcards.");
  }
};
export const getEmbedding = async (text) => {
  if (!client) {
    throw new Error("AI client is not initialized.");
  }
  try {
    const result = await client.embeddings.create({
      // Use the new deployment name
      deployment: embeddingDeployment, 
      input: text,
    });
    return result.data[0].embedding; // Returns the vector array
  } catch (error) {
    console.error("Error getting embedding:", error);
    throw new Error("Failed to get AI embedding.");
  }
};
