import { GoogleGenerativeAI } from '@google/generative-ai';

function getGenAI() {
  const key = process.env.GEMINI_API_KEY ?? '';
  if (!key) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(key);
}

export function getGeminiModel(modelName = 'gemini-2.0-flash', systemInstruction?: string) {
  const config: { model: string; systemInstruction?: string } = { model: modelName };
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }
  return getGenAI().getGenerativeModel(config);
}

/**
 * Send a single prompt and return the text response.
 */
export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Sanitize chat history for Gemini API:
 * - Must start with 'user' role
 * - Filter out entries with empty text
 */
function sanitizeHistory(
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  // Filter entries that have valid non-empty text
  const filtered = history.filter(
    (entry) => entry.parts && entry.parts.length > 0 && entry.parts[0].text?.trim()
  );
  // Gemini requires history to start with a 'user' role message
  const firstUserIdx = filtered.findIndex((e) => e.role === 'user');
  if (firstUserIdx < 0) return [];
  return filtered.slice(firstUserIdx);
}

/**
 * Continue a multi-turn chat with history.
 */
export async function generateChatResponse(
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  userMessage: string,
  systemContext?: string
): Promise<string> {
  const model = getGeminiModel('gemini-2.0-flash', systemContext);
  const safeHistory = sanitizeHistory(history);
  const chat = model.startChat({ history: safeHistory });

  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}
