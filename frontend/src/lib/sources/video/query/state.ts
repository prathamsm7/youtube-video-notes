import { Annotation } from "@langchain/langgraph";
import type { ChatHistoryMessage } from "../types";

export const VideoQueryStateAnnotation = Annotation.Root({
  videoId: Annotation<string>,
  query: Annotation<string>,
  chatHistory: Annotation<ChatHistoryMessage[]>,
  cachedSummary: Annotation<string | null>,
  intent: Annotation<"SUMMARY" | "QA" | "OFF_TOPIC">,
  searchQuery: Annotation<string>,
  queryEmbedding: Annotation<number[] | null>,
  language: Annotation<string>,
  needsChatHistory: Annotation<boolean>,
  context: Annotation<string | null>,
  retrievedDocuments: Annotation<string[]>,
  response: Annotation<string>,
  summaryGenerated: Annotation<boolean>,
  error: Annotation<string | null>,
});

export type VideoQueryState = typeof VideoQueryStateAnnotation.State;
