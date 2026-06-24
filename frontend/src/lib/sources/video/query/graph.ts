import { END, START, StateGraph } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { stream } from "@/lib/core/ai-handler";
import {
  CHAT_MODEL_ANSWER_PRIMARY,
  RETRIEVAL_CHUNK_LIMIT,
} from "@/lib/core/rag/constants";
import { embedQuery } from "@/lib/core/rag/embedding";
import type { QueryIntent } from "../types";
import { analyzeQuery } from "./router";
import { retrieveContextWithVector } from "./retrieval";
import { mapReduceSummary } from "./summarizer";
import { buildVideoAnswerSystemPrompt, buildVideoAnswerUserPrompt } from "./prompts";
import { VideoQueryStateAnnotation, type VideoQueryState } from "./state";

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
  state: VideoQueryState,
  config: LangGraphRunnableConfig,
) {
  emit(config, { type: "status", phase: "analyzing" });
  const [result, queryEmbedding] = await Promise.all([
    analyzeQuery(state.query, state.chatHistory ?? []),
    embedQuery(state.query),
  ]);
  return {
    intent: result.intent,
    searchQuery: result.search_query,
    queryEmbedding,
    language: result.language,
    needsChatHistory: result.needs_chat_history,
  };
}

function routeAfterIntent(state: VideoQueryState) {
  if (state.intent === "SUMMARY") {
    return "summarize";
  }
  return "prepare_rag";
}

async function summarizeNode(state: VideoQueryState, config: LangGraphRunnableConfig) {
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
    const summary = await mapReduceSummary(state.videoId, state.language, (token) => {
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
    console.error("[video/query] error generating summary:", error);
    const message = "An error occurred while generating the video summary.";
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
  state: VideoQueryState,
  config: LangGraphRunnableConfig,
) {
  const searchQuery = state.searchQuery || state.query;
  emit(config, { type: "status", phase: "retrieving" });

  let queryVector = state.queryEmbedding;
  if (!queryVector?.length || searchQuery !== state.query) {
    queryVector = await embedQuery(searchQuery);
  }

  const { context, chunkCount } = await retrieveContextWithVector(
    state.videoId,
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
    console.warn("[video/query] no retrieval context", {
      videoId: state.videoId,
      searchQuery,
      chunkCount,
    });
    const message = "The video doesn't contain information about that topic.";
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

function routeAfterPrepare(state: VideoQueryState) {
  if (state.context) {
    return "generate_answer";
  }
  return END;
}

async function generateAnswerNode(
  state: VideoQueryState,
  config: LangGraphRunnableConfig,
) {
  emit(config, { type: "status", phase: "generating" });

  const userPrompt = buildVideoAnswerUserPrompt({
    query: state.query,
    searchQuery: state.searchQuery || state.query,
    language: state.language,
    context: state.context ?? "",
    chatHistory: state.chatHistory,
    needsChatHistory: state.needsChatHistory,
  });

  const response = await stream(
    buildVideoAnswerSystemPrompt(),
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

export function buildVideoQueryGraph() {
  const graph = new StateGraph(VideoQueryStateAnnotation)
    .addNode("analyze_query", analyzeQueryNode)
    .addNode("summarize", summarizeNode)
    .addNode("prepare_rag", prepareRagNode)
    .addNode("generate_answer", generateAnswerNode)
    .addEdge(START, "analyze_query")
    .addConditionalEdges("analyze_query", routeAfterIntent)
    .addEdge("summarize", END)
    .addConditionalEdges("prepare_rag", routeAfterPrepare)
    .addEdge("generate_answer", END);

  return graph.compile();
}
