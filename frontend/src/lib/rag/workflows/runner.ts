import type { AIMessageChunk } from "@langchain/core/messages";
import { buildIngestGraph } from "./ingest-graph";
import { buildQueryGraph } from "./query-graph";
import type {
  ChatHistoryMessage,
  IngestStreamEvent,
  QueryStreamEvent,
} from "../types";

const queryGraph = buildQueryGraph();
const ingestGraph = buildIngestGraph();

const emptyQueryState = {
  filterMessage: null,
  intent: "QA" as const,
  searchQuery: "",
  context: null,
  response: "",
  summaryGenerated: false,
  error: null,
};

const emptyIngestState = {
  status: "extracting",
  transcript: [],
  chunks: [],
  totalChunks: 0,
  processedChunks: 0,
  error: null,
  completed: false,
};

function extractMessageText(content: unknown): string {
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

function toQueryStreamEvent(data: Record<string, unknown>): QueryStreamEvent | null {
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
        intent: payload.intent === "SUMMARY" ? "SUMMARY" : "QA",
        summary_generated: payload.summary_generated === true,
      },
    };
  }

  return null;
}

function toIngestStreamEvent(data: Record<string, unknown>): IngestStreamEvent | null {
  if (data.type === "progress") {
    return {
      type: "progress",
      status: String(data.status ?? ""),
      total_chunks: Number(data.total_chunks ?? 0),
      processed_chunks: Number(data.processed_chunks ?? 0),
    };
  }

  if (data.type === "error") {
    return {
      type: "error",
      video_id: String(data.video_id ?? ""),
      status: String(data.status ?? "failed"),
      error: String(data.error ?? "Processing failed"),
      completed: true,
      ...(typeof data.total_chunks === "number"
        ? { total_chunks: data.total_chunks }
        : {}),
    };
  }

  if (data.type === "complete") {
    return {
      type: "complete",
      video_id: String(data.video_id ?? ""),
      status: String(data.status ?? "completed"),
      total_chunks: Number(data.total_chunks ?? 0),
      processed_chunks: Number(data.processed_chunks ?? 0),
      completed: true,
    };
  }

  return null;
}

export async function* streamQueryResponse(
  videoId: string,
  query: string,
  chatHistory: ChatHistoryMessage[] = [],
  cachedSummary: string | null = null,
): AsyncGenerator<QueryStreamEvent> {
  const stream = await queryGraph.stream(
    {
      videoId,
      query,
      chatHistory,
      cachedSummary,
      ...emptyQueryState,
    },
    { streamMode: ["custom", "messages"] },
  );

  for await (const chunk of stream) {
    const parsed = parseStreamChunk(chunk);
    if (!parsed) continue;

    if (parsed.mode === "custom") {
      const event = toQueryStreamEvent(parsed.data as Record<string, unknown>);
      if (event) yield event;
      continue;
    }

    if (parsed.mode === "messages") {
      const [msgChunk, metadata] = parsed.data as [
        AIMessageChunk,
        { langgraph_node?: string },
      ];
      if (metadata?.langgraph_node !== "generate_answer") {
        continue;
      }

      const content = extractMessageText(msgChunk.content);
      if (content) {
        yield { kind: "token", content };
      }
    }
  }
}

export async function* streamIngestEvents(
  videoId: string,
): AsyncGenerator<IngestStreamEvent> {
  const stream = await ingestGraph.stream(
    { videoId, ...emptyIngestState },
    { streamMode: "custom" },
  );

  for await (const chunk of stream) {
    const parsed = parseStreamChunk(chunk);
    if (!parsed || parsed.mode !== "custom") continue;

    const event = toIngestStreamEvent(parsed.data as Record<string, unknown>);
    if (event) yield event;
  }
}
