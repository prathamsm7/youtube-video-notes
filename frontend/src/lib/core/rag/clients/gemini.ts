import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

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

export function createOpenAIChatModel(
  model: string,
  temperature: number,
  options?: { nostream?: boolean },
): ChatOpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new ChatOpenAI({
    model,
    temperature,
    apiKey,
    ...(options?.nostream ? { tags: ["nostream"] } : {}),
  });
}
