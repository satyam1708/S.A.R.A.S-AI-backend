// aiService.js
import { AzureOpenAI } from 'openai'; // <-- CORRECTED IMPORT

// Get credentials from environment
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_KEY;
// This is the DEPLOYMENT NAME for your chat model (gpt-4o-mini)
const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT; 

let client;

if (!endpoint || !azureApiKey || !deployment) {
  console.error("❌ ERROR: Azure OpenAI environment variables (ENDPOINT, KEY, CHAT_DEPLOYMENT) are not set.");
} else {
  // CORRECTED Client Initialization based on your example
  client = new AzureOpenAI({
    endpoint,
    apiKey: azureApiKey,
    // This api-version is standard, but you can change if yours is different
    apiVersion: "2024-05-01-preview", 
    // The deployment name is passed as a default here
    deployment, 
  });
}

export const summarizeArticle = async (articleContent) => {
  if (!client) {
    throw new Error("AI client is not initialized. Check server logs for errors.");
  }

  const messages = [
    { role: "system", content: "You are an expert news summarizer. Provide a concise, neutral summary of the following article in 3-4 bullet points." },
    { role: "user", content: articleContent },
  ];

  try {
    // CORRECTED API Call (using .create)
    // We don't need to pass the deployment name here since it was set in the client
    const result = await client.chat.completions.create({
      messages: messages,
      max_tokens: 150, // (max_tokens is the v4+ property name)
    });

    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error summarizing article:", error);
    throw new Error("Failed to get AI summary.");
  }
};