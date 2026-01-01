/**
 * AI RESILIENCE UTILITIES
 * Handles retries, JSON cleaning, and error normalization.
 */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Strips Markdown code blocks (```json ... ```) from AI responses
 * to prevent JSON.parse() failures.
 */
export const cleanAIJSON = (rawString) => {
  if (!rawString) return null;
  // Remove ```json and ``` wrapping
  const cleaned = rawString.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return cleaned.trim();
};

/**
 * High-Order Function to retry AI calls with Exponential Backoff
 * Retries on 429 (Rate Limit) and 5xx (Server Errors).
 */
export const withAIRetry = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    const status = error?.status || error?.response?.status;
    
    // Only retry on Rate Limits (429) or Server Errors (500+)
    if (retries > 0 && (status === 429 || status >= 500)) {
      console.warn(`⚠️ AI Busy (429/5xx). Retrying in ${delay}ms... (${retries} left)`);
      await wait(delay);
      return withAIRetry(fn, retries - 1, delay * 2); // Double the delay (Backoff)
    }
    throw error;
  }
};