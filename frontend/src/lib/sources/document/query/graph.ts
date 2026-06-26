import { END, START, StateGraph } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { stream } from "@/lib/core/ai-handler";
import {
  CHAT_MODEL_ANSWER_PRIMARY,
  RETRIEVAL_CHUNK_LIMIT,
} from "@/lib/core/rag/constants";
import { embedQuery } from "@/lib/core/rag/embedding";
import { buildOffTopicResponse, isOffTopicQuery } from "@/lib/core/rag/off-topic";
import { detectQueryLanguage } from "@/lib/core/rag/query-router-schema";
import type { QueryIntent } from "../types";
import { analyzeQuery } from "./router";
import { retrieveContextWithVector } from "./retrieval";
import { mapReduceSummary } from "./summarizer";
import {
  buildDocumentAnswerSystemPrompt,
  buildDocumentAnswerUserPrompt,
} from "./prompts";
import { DocumentQueryStateAnnotation, type DocumentQueryState } from "./state";

type QueryCustomEvent =
  | {
      type: "status";
      phase: "analyzing" | "retrieving" | "generating" | "summarizing";
      total_chunks?: number;
    }
  | { type: "token"; content: string }
  | { type: "meta"; payload: { intent: QueryIntent; summary_generated: boolean } };

function emit(config: LangGraphRunnableConfig, event: QueryCustomEvent) {
  config.writer?.(event);
}

async function analyzeQueryNode(
  state: DocumentQueryState,
  config: LangGraphRunnableConfig,
) {
  emit(config, { type: "status", phase: "analyzing" });

  if (isOffTopicQuery(state.query)) {
    return {
      intent: "OFF_TOPIC" as const,
      searchQuery: "",
      queryEmbedding: null,
      language: detectQueryLanguage(state.query),
      needsChatHistory: false,
    };
  }

  const [result, queryEmbedding] = await Promise.all([
    analyzeQuery(state.query, state.chatHistory ?? []),
    embedQuery(state.query),
  ]);

  if (result.intent === "OFF_TOPIC") {
    return {
      intent: "OFF_TOPIC" as const,
      searchQuery: "",
      queryEmbedding: null,
      language: result.language,
      needsChatHistory: false,
    };
  }

  return {
    intent: result.intent,
    searchQuery: result.search_query,
    queryEmbedding,
    language: result.language,
    needsChatHistory: result.needs_chat_history,
  };
}

function routeAfterIntent(state: DocumentQueryState) {
  if (state.intent === "SUMMARY") {
    return "summarize";
  }
  if (state.intent === "OFF_TOPIC") {
    return "handle_off_topic";
  }
  return "prepare_rag";
}

async function handleOffTopicNode(
  state: DocumentQueryState,
  config: LangGraphRunnableConfig,
) {
  const message = buildOffTopicResponse(state.query, state.language, "document");
  emit(config, { type: "token", content: message });
  emit(config, {
    type: "meta",
    payload: { intent: "OFF_TOPIC", summary_generated: false },
  });
  return {
    response: message,
    intent: "OFF_TOPIC" as const,
  };
}

async function summarizeNode(state: DocumentQueryState, config: LangGraphRunnableConfig) {
  const cached = state.cachedSummary?.trim();
  if (cached) {
    emit(config, { type: "token", content: cached });
    emit(config, {
      type: "meta",
      payload: { intent: "SUMMARY", summary_generated: false },
    });
    return {
      response: cached,
      intent: "SUMMARY" as const,
      summaryGenerated: false,
    };
  }

  emit(config, { type: "status", phase: "summarizing" });
  try {
    const summary = await mapReduceSummary(state.documentId, state.language, (token) => {
      emit(config, { type: "token", content: token });
    });
    emit(config, {
      type: "meta",
      payload: { intent: "SUMMARY", summary_generated: true },
    });
    return {
      response: summary,
      intent: "SUMMARY" as const,
      summaryGenerated: true,
    };
  } catch (error) {
    console.error("[document/query] error generating summary:", error);
    const message = "An error occurred while generating the document summary.";
    emit(config, { type: "token", content: message });
    emit(config, {
      type: "meta",
      payload: { intent: "SUMMARY", summary_generated: false },
    });
    return {
      response: message,
      intent: "SUMMARY" as const,
      error: error instanceof Error ? error.message : "summary failed",
    };
  }
}

async function prepareRagNode(
  state: DocumentQueryState,
  config: LangGraphRunnableConfig,
) {
  const searchQuery = state.searchQuery || state.query;
  emit(config, { type: "status", phase: "retrieving" });

  let queryVector = state.queryEmbedding;
  if (!queryVector?.length || searchQuery !== state.query) {
    queryVector = await embedQuery(searchQuery);
  }

  const { context, chunkCount } = await retrieveContextWithVector(
    state.documentId,
    searchQuery,
    queryVector,
    RETRIEVAL_CHUNK_LIMIT,
  );

  emit(config, {
    type: "status",
    phase: "retrieving",
    total_chunks: chunkCount,
  });

  if (!context) {
    const message = "The document doesn't contain information about that topic.";
    emit(config, { type: "token", content: message });
    emit(config, {
      type: "meta",
      payload: { intent: "QA", summary_generated: false },
    });
    return {
      searchQuery,
      response: message,
      context: null,
    };
  }

  return { searchQuery, context };
}

function routeAfterPrepare(state: DocumentQueryState) {
  if (state.context) {
    return "generate_answer";
  }
  return END;
}

async function generateAnswerNode(
  state: DocumentQueryState,
  config: LangGraphRunnableConfig,
) {
  emit(config, { type: "status", phase: "generating" });

  const userPrompt = buildDocumentAnswerUserPrompt({
    query: state.query,
    searchQuery: state.searchQuery || state.query,
    language: state.language,
    context: state.context ?? "",
    chatHistory: state.chatHistory,
    needsChatHistory: state.needsChatHistory,
  });

  const response = await stream(
    buildDocumentAnswerSystemPrompt(),
    userPrompt,
    CHAT_MODEL_ANSWER_PRIMARY,
    (token) => emit(config, { type: "token", content: token }),
    0.1,
  );

  emit(config, {
    type: "meta",
    payload: { intent: "QA", summary_generated: false },
  });

  return {
    response,
    intent: "QA" as const,
  };
}

export function buildDocumentQueryGraph() {
  const graph = new StateGraph(DocumentQueryStateAnnotation)
    .addNode("analyze_query", analyzeQueryNode)
    .addNode("summarize", summarizeNode)
    .addNode("handle_off_topic", handleOffTopicNode)
    .addNode("prepare_rag", prepareRagNode)
    .addNode("generate_answer", generateAnswerNode)
    .addEdge(START, "analyze_query")
    .addConditionalEdges("analyze_query", routeAfterIntent)
    .addEdge("summarize", END)
    .addEdge("handle_off_topic", END)
    .addConditionalEdges("prepare_rag", routeAfterPrepare)
    .addEdge("generate_answer", END);

  return graph.compile();
}
