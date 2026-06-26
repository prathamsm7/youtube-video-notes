import { Annotation } from "@langchain/langgraph";
import type { ChatHistoryMessage } from "../types";

export const DocumentQueryStateAnnotation = Annotation.Root({
  documentId: Annotation<string>,
  query: Annotation<string>,
  chatHistory: Annotation<ChatHistoryMessage[]>,
  cachedSummary: Annotation<string | null>,
  intent: Annotation<"SUMMARY" | "QA">,
  searchQuery: Annotation<string>,
  queryEmbedding: Annotation<number[] | null>,
  language: Annotation<string>,
  needsChatHistory: Annotation<boolean>,
  context: Annotation<string | null>,
  response: Annotation<string>,
  summaryGenerated: Annotation<boolean>,
  error: Annotation<string | null>,
});

export type DocumentQueryState = typeof DocumentQueryStateAnnotation.State;
