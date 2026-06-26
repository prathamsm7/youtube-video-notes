import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOpenAIChatModel } from "./rag/clients/gemini";

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

export async function generate(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature = 0.2,
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

export async function generateStructured<T extends Record<string, unknown>>(
  systemPrompt: string,
  userPrompt: string,
  schema: Record<string, unknown>,
  schemaName: string,
  model: string,
  temperature = 0,
): Promise<T> {
  const llm = createOpenAIChatModel(model, temperature, { nostream: true });
  const structured = llm.withStructuredOutput(schema, {
    name: schemaName,
    method: "jsonSchema",
    strict: true,
  });
  return (await structured.invoke([
    new SystemMessage(systemPrompt.trim()),
    new HumanMessage(userPrompt.trim()),
  ])) as T;
}

export async function stream(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  onToken: (token: string) => void,
  temperature = 0.2,
  options?: GenerateOptions,
): Promise<string> {
  const llm = createOpenAIChatModel(model, temperature, {
    nostream: options?.nostream !== false,
  });
  let fullText = "";

  const tokenStream = await llm.stream([
    new SystemMessage(systemPrompt.trim()),
    new HumanMessage(userPrompt.trim()),
  ]);
  for await (const chunk of tokenStream) {
    const text = extractText(chunk.content);
    if (text) {
      fullText += text;
      onToken(text);
    }
  }

  return fullText.trim() || "No content generated.";
}
