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

  let prompt = `You are summarizing document chunks for retrieval.

CONTENT TO ANALYZE:
TEXT CONTENT:
${textSection}
`;

  if (tables.length > 0) {
    prompt += "\nTABLES:\n";
    for (let i = 0; i < tables.length; i += 1) {
      const table = tables[i];
      if (table.caption) {
        prompt += `Table caption (preserve this label exactly): ${table.caption}\n`;
      }
      prompt += `Table ${i + 1} HTML:\n${table.html}\n\n`;
    }
    prompt +=
      "\nFor each table: extract the exact label, headers, row names, numeric values, units, and the main comparison or relationship shown. Keep the summary literal and grounded in the table contents.\n";
  }

  if (images.length > 0) {
    prompt += `\nIMAGES: ${images.length} image(s) are attached after this text. Analyze every attached image in detail.\n`;
    for (let i = 0; i < images.length; i += 1) {
      const image = images[i];
      if (image.caption) {
        prompt += `Image ${i + 1} caption (preserve this label exactly): ${image.caption}\n`;
      }
    }
    prompt +=
      "For each image: describe the exact figure label, chart or diagram structure, axes, labels, legends, visible text, and numeric data. Keep the summary literal and grounded in the visible content.\n";
  }

  prompt += `
YOUR TASK:
Write one concise but detailed retrieval summary for this chunk.
Preserve exact figure and table labels such as Figure 2 or Table 1.
Do not add alternative search terms.
Do not add questions this content could answer.
Do not invent information beyond the text, tables, or images provided.
Prioritize exact labels, headers, row names, visible text, numbers, units, and relationships.
Do not say you cannot see images; use the attached image content directly.

SUMMARY:`;

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
      text: image.caption
        ? `Attached image ${i + 1} of ${content.images.length} — caption: ${image.caption}`
        : `Attached image ${i + 1} of ${content.images.length}:`,
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
        "You are an expert at summarizing document chunks for semantic retrieval. " +
          "Keep summaries literal, compact, and grounded in the provided text, tables, and images. " +
          "Always preserve exact figure and table labels from captions.",
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
