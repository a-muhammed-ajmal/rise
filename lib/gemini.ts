import { GoogleGenerativeAI } from '@google/generative-ai';

function getGenAI() {
  const key = process.env.GEMINI_API_KEY ?? '';
  return new GoogleGenerativeAI(key);
}

export function getGeminiModel(modelName = 'gemini-1.5-flash') {
  return getGenAI().getGenerativeModel({ model: modelName });
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
 * Continue a multi-turn chat with history.
 */
export async function generateChatResponse(
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  userMessage: string,
  systemContext?: string
): Promise<string> {
  const model = getGeminiModel();
  const chat = model.startChat({ history });

  const fullMessage = systemContext
    ? `${systemContext}\n\nUser: ${userMessage}`
    : userMessage;

  const result = await chat.sendMessage(fullMessage);
  return result.response.text();
}
