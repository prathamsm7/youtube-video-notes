import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createOpenAIChatModel } from "@/lib/core/rag/clients/gemini";
import type { ChunkContentData } from "../content";
import {
  DOCUMENT_SUMMARY_CONCURRENCY,
  DOCUMENT_SUMMARY_MODEL,
} from "../constants";

export type SummarizedChunk = {
  chunkIndex: number;
  elementId: string | null;
  pageNumber: number | null;
  content: ChunkContentData;
  summary: string;
};

type SummaryMessageContent =
  | { type: "text"; text: string }
  | {
      type: "image";
      source_type: "base64";
      mime_type: string;
      data: string;
      metadata?: { detail: "high" | "low" | "auto" };
    };

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function buildSummaryPrompt(content: ChunkContentData): string {
  const { text, tables, images } = content;
  const textSection = text.trim() || "(No surrounding text in this chunk)";

  let prompt = `You are creating a searchable description for document content retrieval.

CONTENT TO ANALYZE:
TEXT CONTENT:
${textSection}
`;

  if (tables.length > 0) {
    prompt += "\nTABLES (HTML):\n";
    for (let i = 0; i < tables.length; i += 1) {
      prompt += `Table ${i + 1}:\n${tables[i]}\n\n`;
    }
    prompt +=
      "\nFor each table: extract all headers, rows, numeric values, units, and relationships. Summarize what the table shows.\n";
  }

  if (images.length > 0) {
    prompt += `\nIMAGES: ${images.length} image(s) are attached after this text. Analyze every attached image in detail.\n`;
    prompt +=
      "For each image: describe charts, diagrams, axes, labels, legends, trends, entities, text visible in the image, and any numeric data shown.\n";
  }

  prompt += `
YOUR TASK:
Generate a comprehensive, searchable description that covers:

1. Key facts, numbers, and data points from text and tables
2. Main topics and concepts discussed
3. Questions this content could answer
4. Visual content analysis (charts, diagrams, patterns in images) — required when images are attached
5. Alternative search terms users might use

Make it detailed and searchable - prioritize findability over brevity.
Do not say you cannot see images; use the attached image content directly.

SEARCHABLE DESCRIPTION:`;

  return prompt;
}

function buildMultimodalMessageContent(
  content: ChunkContentData,
): SummaryMessageContent[] {
  const messageContent: SummaryMessageContent[] = [
    { type: "text", text: buildSummaryPrompt(content) },
  ];

  for (let i = 0; i < content.images.length; i += 1) {
    const image = content.images[i];
    messageContent.push({
      type: "text",
      text: `Attached image ${i + 1} of ${content.images.length}:`,
    });
    messageContent.push({
      type: "image",
      source_type: "base64",
      mime_type: image.mimeType,
      data: image.data,
      metadata: { detail: "high" },
    });
  }

  return messageContent;
}

function fallbackSummary(content: ChunkContentData): string {
  const preview = content.text.slice(0, 300);
  let summary = preview.length < content.text.length ? `${preview}...` : preview;
  if (content.tables.length > 0) {
    summary += ` [Contains ${content.tables.length} table(s)]`;
  }
  if (content.images.length > 0) {
    summary += ` [Contains ${content.images.length} image(s)]`;
  }
  return summary;
}

export async function createAiEnhancedSummary(
  content: ChunkContentData,
): Promise<string> {
  const { tables, images } = content;
  const hasMixedContent = tables.length > 0 || images.length > 0;

  if (!hasMixedContent) {
    return content.text.trim() || "Empty chunk";
  }

  try {
    const llm = createOpenAIChatModel(DOCUMENT_SUMMARY_MODEL, 0, {
      nostream: true,
    });
    const messageContent = buildMultimodalMessageContent(content);

    const response = await llm.invoke([
      new SystemMessage(
        "You are an expert at summarizing document chunks for semantic search. " +
          "When tables or images are provided, you must extract and describe their content in detail.",
      ),
      new HumanMessage({ content: messageContent }),
    ]);
    const summary = extractText(response.content).trim();
    return summary || fallbackSummary(content);
  } catch (error) {
    console.error("[document/ingest] AI summary failed:", error);
    return fallbackSummary(content);
  }
}

export async function* summarizeDocumentChunksStream(
  chunks: Array<{
    element_id: string | null;
    page_number: number | null;
    content: ChunkContentData;
  }>,
): AsyncGenerator<{ processed: number; total: number; chunk: SummarizedChunk }> {
  const total = chunks.length;
  const concurrency = Math.min(DOCUMENT_SUMMARY_CONCURRENCY, total);
  let completed = 0;

  for (let start = 0; start < total; start += concurrency) {
    const batch = chunks.slice(start, start + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (chunk, batchOffset) => {
        const chunkIndex = start + batchOffset;
        const summary = await createAiEnhancedSummary(chunk.content);
        return {
          chunkIndex,
          elementId: chunk.element_id,
          pageNumber: chunk.page_number,
          content: chunk.content,
          summary,
        };
      }),
    );

    for (const summarized of batchResults) {
      completed += 1;
      yield { processed: completed, total, chunk: summarized };
    }
  }
}
