import { traceConfig } from "@/lib/core/rag/clients/langsmith";
import { buildDocumentQueryGraph } from "./query/graph";
import type {
  ChatHistoryMessage,
  DocumentIngestStreamEvent,
  DocumentQueryStreamEvent,
} from "./types";

const queryGraph = buildDocumentQueryGraph();

const emptyQueryState = {
  intent: "QA" as const,
  searchQuery: "",
  queryEmbedding: null,
  language: "English",
  needsChatHistory: false,
  context: null,
  response: "",
  summaryGenerated: false,
  error: null,
};

function parseStreamChunk(
  chunk: unknown,
): { mode: string; data: unknown } | null {
  if (Array.isArray(chunk) && chunk.length === 2 && typeof chunk[0] === "string") {
    return { mode: chunk[0], data: chunk[1] };
  }

  if (typeof chunk === "object" && chunk !== null && "type" in chunk) {
    return { mode: "custom", data: chunk };
  }

  return null;
}

function toQueryStreamEvent(data: Record<string, unknown>): DocumentQueryStreamEvent | null {
  if (data.type === "status" && typeof data.phase === "string") {
    const phase = data.phase as
      | "analyzing"
      | "retrieving"
      | "generating"
      | "summarizing";
    return {
      kind: "status",
      phase,
      ...(typeof data.total_chunks === "number"
        ? { total_chunks: data.total_chunks }
        : {}),
    };
  }

  if (data.type === "token" && typeof data.content === "string") {
    return { kind: "token", content: data.content };
  }

  if (data.type === "meta" && data.payload && typeof data.payload === "object") {
    const payload = data.payload as {
      intent?: string;
      summary_generated?: boolean;
    };
    return {
      kind: "meta",
      payload: {
        intent:
          payload.intent === "SUMMARY"
            ? "SUMMARY"
            : payload.intent === "OFF_TOPIC"
              ? "OFF_TOPIC"
              : "QA",
        summary_generated: payload.summary_generated === true,
      },
    };
  }

  return null;
}

export async function* streamDocumentQuery(
  documentId: string,
  query: string,
  chatHistory: ChatHistoryMessage[] = [],
  cachedSummary: string | null = null,
  meta?: { userId?: number; chatId?: string },
): AsyncGenerator<DocumentQueryStreamEvent> {
  const stream = await queryGraph.stream(
    {
      documentId,
      query,
      chatHistory,
      cachedSummary,
      ...emptyQueryState,
    },
    {
      streamMode: "custom",
      ...traceConfig("document-query", { documentId, ...meta }),
    },
  );

  for await (const chunk of stream) {
    const parsed = parseStreamChunk(chunk);
    if (!parsed || parsed.mode !== "custom") continue;

    const event = toQueryStreamEvent(parsed.data as Record<string, unknown>);
    if (event) yield event;
  }
}

export { streamDocumentIngest } from "./ingest/runner";
