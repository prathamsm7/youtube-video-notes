import { HumanMessage } from "@langchain/core/messages";
import { createGeminiChatModel } from "./clients/gemini";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }

  return "";
}

type GenerateOptions = {
  /** Exclude tokens from LangGraph `messages` stream (default: true). */
  nostream?: boolean;
};

async function generateOnce(
  model: string,
  prompt: string,
  temperature: number,
  options?: GenerateOptions,
): Promise<string> {
  const llm = createGeminiChatModel(model, temperature, {
    nostream: options?.nostream !== false,
  });
  const response = await llm.invoke([new HumanMessage(prompt)]);
  const text = extractText(response.content).trim();
  return text || "No content generated.";
}

export async function generateWithFallback(
  prompt: string,
  primaryModel: string,
  fallbackModel: string,
  temperature = 0.2,
  options?: GenerateOptions,
): Promise<string> {
  const models = [primaryModel, fallbackModel];
  let lastError: unknown;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await generateOnce(model, prompt, temperature, options);
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await sleep(2 ** attempt * 1000);
        }
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("LLM generation failed");
}
