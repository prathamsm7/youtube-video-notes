import { END, START, StateGraph } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { streamWithFallback } from "../ai-handler";
import {
  CHAT_MODEL_ANSWER_FALLBACK,
  CHAT_MODEL_ANSWER_PRIMARY,
} from "../constants";
import { analyzeQuery, ruleBasedFilter } from "../query/router";
import { retrieveContext } from "../query/retrieval";
import { mapReduceSummary } from "../query/summarizer";
import type { ChatHistoryMessage, QueryIntent } from "../types";
import { QueryStateAnnotation, type QueryState } from "./states";

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

function formatChatHistory(chatHistory: ChatHistoryMessage[]): string {
  if (!chatHistory.length) {
    return "";
  }

  const formatted = chatHistory
    .slice(-6)
    .map(
      (msg) =>
        `${msg.role.charAt(0).toUpperCase()}${msg.role.slice(1)}: ${msg.content}`,
    )
    .join("\n");

  return `Chat History:\n${formatted}\n\n`;
}

function buildAnswerPrompt(
  query: string,
  language: string,
  context: string,
  chatHistory: ChatHistoryMessage[],
): string {
  const chatHistoryStr = formatChatHistory(chatHistory);
  return `
You are an expert teacher experienced in teaching with more than 20 years. Your task is to answer the user query using the context is provided.
Only answer the question dont share any other information(your identity, your role, etc.) to user in answer, only provide answer to the query.

${chatHistoryStr}

Latest User Query:
${query}

Detected answer language: ${language}

Context:
${context}


Instructions:
- Write the entire answer in ${language} only.
- The Context may be in a different language — translate and explain in ${language}.
- Provide step-by-step explanation, use pointers if required or asked for it, else provide short answer in detailed.
- Explain concepts clearly (like teaching a student)
- Do NOT add information not present in context
- If incomplete → say "Partial information available"
- If not sure about answer just say I dont know the answer with the short 1-2 lines.
- Always add the bottomline for answer in 1-2 lines if answer found.
- Citation rules (when Context includes timestamp labels like [8:40 - 9:48]):
  - For each bullet point or explanation line, append the citation at the END of that line in this exact format: ( MM:SS - MM:SS )
  - Example: **Pattern Recognition:** LLMs identify statistical patterns in text. ( 8:40 - 9:48 )
  - Use ONLY timestamp ranges that appear in the Context labels above.
  - Do NOT invent timestamps. If no matching segment exists for a point, omit the citation.
  - Keep timestamp format as MM:SS or H:MM:SS matching the Context label.

Format:
- Use headings
- Use bullet points
- Add explanation under each point
`;
}

async function filterQueryNode(
  state: QueryState,
  config: LangGraphRunnableConfig,
) {
  const filterMessage = ruleBasedFilter(state.query);
  if (filterMessage) {
    emit(config, { type: "token", content: filterMessage });
    emit(config, {
      type: "meta",
      payload: { intent: "QA", summary_generated: false },
    });
    return {
      filterMessage,
      response: filterMessage,
      intent: "QA" as const,
      summaryGenerated: false,
    };
  }

  return { filterMessage: null };
}

function routeAfterFilter(state: QueryState) {
  if (state.filterMessage) {
    return END;
  }
  return "analyze_query";
}

async function analyzeQueryNode(
  state: QueryState,
  config: LangGraphRunnableConfig,
) {
  emit(config, { type: "status", phase: "analyzing" });
  const result = await analyzeQuery(state.query, state.chatHistory ?? []);
  return {
    intent: result.intent,
    searchQuery: result.search_query,
    language: result.language,
    needsChatHistory: result.needs_chat_history,
  };
}

function routeAfterIntent(state: QueryState) {
  if (state.intent === "SUMMARY") {
    return "summarize";
  }
  return "prepare_rag";
}

async function summarizeNode(state: QueryState, config: LangGraphRunnableConfig) {
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
    console.error("Error generating summary:", error);
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
  state: QueryState,
  config: LangGraphRunnableConfig,
) {
  const searchQuery = state.searchQuery || state.query;
  emit(config, { type: "status", phase: "retrieving" });

  const { context, chunkCount } = await retrieveContext(
    state.videoId,
    searchQuery,
    8,
    0.45
  );

  emit(config, {
    type: "status",
    phase: "retrieving",
    total_chunks: chunkCount,
  });

  if (!context) {
    console.warn("[rag/query] no retrieval context", {
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

function routeAfterPrepare(state: QueryState) {
  if (state.context) {
    return "generate_answer";
  }
  return END;
}

async function generateAnswerNode(
  state: QueryState,
  config: LangGraphRunnableConfig,
) {
  emit(config, { type: "status", phase: "generating" });

  const historyForAnswer = state.needsChatHistory ? (state.chatHistory ?? []) : [];
  const prompt = buildAnswerPrompt(
    state.query,
    state.language || "English",
    state.context ?? "",
    historyForAnswer,
  );

  const response = await streamWithFallback(
    prompt,
    CHAT_MODEL_ANSWER_PRIMARY,
    CHAT_MODEL_ANSWER_FALLBACK,
    (token) => emit(config, { type: "token", content: token }),
    0,
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

export function buildQueryGraph() {
  const graph = new StateGraph(QueryStateAnnotation)
    .addNode("filter_query", filterQueryNode)
    .addNode("analyze_query", analyzeQueryNode)
    .addNode("summarize", summarizeNode)
    .addNode("prepare_rag", prepareRagNode)
    .addNode("generate_answer", generateAnswerNode)
    .addEdge(START, "filter_query")
    .addConditionalEdges("filter_query", routeAfterFilter)
    .addConditionalEdges("analyze_query", routeAfterIntent)
    .addEdge("summarize", END)
    .addConditionalEdges("prepare_rag", routeAfterPrepare)
    .addEdge("generate_answer", END);

  return graph.compile();
}
