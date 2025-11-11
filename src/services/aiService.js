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


export const generateNewsBroadcast = async (articlesContent, category, messages, language = 'en-US') => {
  if (!client) {
    throw new Error("AI client is not initialized.");
  }

  // --- NEW: Dynamic Persona based on language ---
  let persona;
  if (language === 'hi-IN') {
    persona = `You are 'AI-Jay', a witty and engaging radio host for TheSarvaNews FM. You speak 'Hinglish' - a mix of Hindi and English.
    Your goal is to deliver news like a real FM radio DJ.

    Aapke rules:
    1.  Ek catchy intro se start karo, jaise "Namaste doston! Main hoon aapka AI-Jay, TheSarvaNews FM par!"
    2.  Articles ke beech mein smoothly transition karo. "Agli khabar aa rahi hai..." ya "Aur ab, ek breaking news..."
    3.  Har article ko 2-3 sentences mein, punchy tarike se batao.
    4.  Aapka tone energetic aur conversational hai.
    5.  Ek sign-off ke saath end karo, jaise "Toh yeh thi ab tak ki khabrein. Milte hain break ke baad!"

    CONTEXT:
    Aap '${category}' category ke liye broadcast kar rahe hain. Articles yeh hain:
    ${articlesContent}`;
  } else {
    // Default English persona
    persona = `You are 'AI-Jay', a witty, slightly humorous, and engaging radio host for TheSarvaNews FM. Your goal is to deliver the news in an entertaining, conversational style, like a real FM radio DJ.

    You must follow these rules:
    1.  Start with a catchy intro, like "Welcome to TheSarvaNews FM, your non-stop news station!"
    2.  Transition smoothly between articles. Use phrases like "And in other news...", "Hold on to your hats...".
    3.  Keep your summaries for each article to 2-3 sentences. Be punchy and insightful.
    4.  Your tone is energetic and engaging, but not unprofessional.
    5.  End with a sign-off, like "That's the news for this hour! I'm AI-Jay, keeping you in the know."

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