import { Annotation } from "@langchain/langgraph";
import type { ChatHistoryMessage, TextChunk, TranscriptSegment } from "../types";

export const QueryStateAnnotation = Annotation.Root({
  videoId: Annotation<string>,
  query: Annotation<string>,
  chatHistory: Annotation<ChatHistoryMessage[]>,
  cachedSummary: Annotation<string | null>,
  filterMessage: Annotation<string | null>,
  intent: Annotation<"SUMMARY" | "QA">,
  searchQuery: Annotation<string>,
  context: Annotation<string | null>,
  response: Annotation<string>,
  summaryGenerated: Annotation<boolean>,
  error: Annotation<string | null>,
});

export type QueryState = typeof QueryStateAnnotation.State;

export const IngestStateAnnotation = Annotation.Root({
  videoId: Annotation<string>,
  status: Annotation<string>,
  transcript: Annotation<TranscriptSegment[]>,
  chunks: Annotation<TextChunk[]>,
  totalChunks: Annotation<number>,
  processedChunks: Annotation<number>,
  error: Annotation<string | null>,
  completed: Annotation<boolean>,
});

export type IngestState = typeof IngestStateAnnotation.State;
