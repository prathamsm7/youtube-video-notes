import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export function createGeminiChatModel(
  model: string,
  temperature: number,
  options?: { nostream?: boolean },
): ChatGoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return new ChatGoogleGenerativeAI({
    model,
    temperature,
    apiKey,
    ...(options?.nostream ? { tags: ["nostream"] } : {}),
  });
}
