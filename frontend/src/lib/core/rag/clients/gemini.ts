import { ChatOpenAI } from "@langchain/openai";

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
