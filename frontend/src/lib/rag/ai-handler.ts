import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOpenAIChatModel } from "./clients/gemini";

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
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  options?: GenerateOptions,
): Promise<string> {
  const llm = createOpenAIChatModel(model, temperature, {
    nostream: options?.nostream !== false,
  });
  const response = await llm.invoke([
    new SystemMessage(systemPrompt.trim()),
    new HumanMessage(userPrompt.trim()),
  ]);
  const text = extractText(response.content).trim();
  return text || "No content generated.";
}

async function streamOnce(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  onToken: (token: string) => void,
  options?: GenerateOptions,
): Promise<string> {
  const llm = createOpenAIChatModel(model, temperature, {
    nostream: options?.nostream !== false,
  });
  let fullText = "";

  const stream = await llm.stream([
    new SystemMessage(systemPrompt.trim()),
    new HumanMessage(userPrompt.trim()),
  ]);
  for await (const chunk of stream) {
    const text = extractText(chunk.content);
    if (text) {
      fullText += text;
      onToken(text);
    }
  }

  return fullText.trim() || "No content generated.";
}

export async function generate(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature = 0.2,
  options?: GenerateOptions,
): Promise<string> {
  return generateOnce(model, systemPrompt, userPrompt, temperature, options);
}

export async function generateWithFallback(
  systemPrompt: string,
  userPrompt: string,
  primaryModel: string,
  fallbackModel: string,
  temperature = 0.2,
  options?: GenerateOptions,
): Promise<string> {
  const models = [primaryModel, fallbackModel];
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await generateOnce(model, systemPrompt, userPrompt, temperature, options);
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

export async function stream(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  onToken: (token: string) => void,
  temperature = 0.2,
  options?: GenerateOptions,
): Promise<string> {
  return streamOnce(model, systemPrompt, userPrompt, temperature, onToken, options);
}
