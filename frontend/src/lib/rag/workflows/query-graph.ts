import { END, START, StateGraph } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { stream } from "../ai-handler";
import {
  CHAT_MODEL_ANSWER_PRIMARY,
  RETRIEVAL_CHUNK_LIMIT,
} from "../constants";
import { embedQuery } from "../ingestion/embedder";
import { analyzeQuery } from "../query/router";
import { retrieveContextWithVector } from "../query/retrieval";
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

function formatAnswerChatHistory(chatHistory: ChatHistoryMessage[]): string {

  if (!chatHistory.length) {
    return "";
  }
  
  return chatHistory
    .slice(-6)
    .map((msg, index) => {
      const role = msg.role === "user" ? "User" : "Assistant";
      return `[Turn ${index + 1}]\n${role}: ${msg.content.trim()}`;
    })
    .join("\n\n");
}

async function analyzeQueryNode(
  state: QueryState,
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

  const systemPrompt = `You are an expert chat assistant. Your task is to answer the user query using the context provided.
    Only answer the question dont share any other information(your identity, your role, etc.) to user in answer.
    Only provide answer to the asked query in detailed, nothing else.

    Instructions:
    - Answer ONLY in the same language as the Current User Query. Never switch language based on Context or Chat History.
    - If Context is in a different language, translate the relevant parts into the query language.
    - Chat History is provided only for follow-up questions. If the Chat History section is absent, do not reference or use prior turns.
    - Start with short answer to the query and then expand it in detailed below .
    - Explain each concept clearly using the context provided.
    - Do NOT add information not present in context.
    - DO not add made up examples in the answer.
    - If incomplete → say "Partial information available".
    - If not sure about answer just say I dont know the answer with the short 1-2 lines.
    - Always add the bottomline for answer in 1-2 lines if answer found.
    - Citation rules (when Context includes timestamp labels like [8:40 - 9:48]):
      - For each bullet point or explanation line, append the citation at the END of that line in this exact format: ( MM:SS - MM:SS )
      - Example: **Pattern Recognition:** LLMs identify statistical patterns in text. ( 8:40 - 9:48 )
      - Use ONLY timestamp ranges that appear in the Context labels above.
      - Do NOT invent timestamps. If no matching segment exists for a point, omit the citation.
      - Keep timestamp format as MM:SS or H:MM:SS matching the Context label.
    - Maintain the professional and friendly tone.

    Format:
    - Use bullet points, Add explanation under each point if required.
    - Return the answer in Markdown format.

    Example:
    Question: Benefits of Self Attention
    Answer: The self-attention mechanism offers significant advantages over traditional sequential models like RNNs, as detailed in the video (31:18 - 34:29). These primary benefits include:

            Parallelization and Efficiency (31:18 - 33:05): In RNNs, processing must occur sequentially, meaning the model must finish one word before moving to the next. In contrast, self-attention processes all words in a sequence simultaneously. This allows for massive parallelization on modern hardware (like GPUs), making training significantly faster.
            Computational Complexity (33:01 - 33:17): Because self-attention eliminates the need for sequential processing, the computational order is 
            relative to the sequence length, whereas RNN processing order is O(n^2), where n is the sequence length.
            Capturing Long-Range Dependencies (33:18 - 34:29): One of the biggest challenges for RNNs is remembering relationships between words at the beginning of a long sentence and those at the end. Because self-attention evaluates the relationship between every word in a sequence directly, it can effortlessly capture these long-range dependencies regardless of the distance between words.
            
            Bottom Line: The self-attention mechanism is a powerful tool for natural language processing tasks, offering significant advantages over traditional sequential models like RNNs.


  `;

  const userPrompt = `${
    state.needsChatHistory && state.chatHistory?.length
      ? `--- Chat History ---\n${formatAnswerChatHistory(state.chatHistory)}\n--- End Chat History ---\n\n`
      : ""
  }--- Current User Query ---
${state.query.trim()}
Query language: ${state.language}
--- End Current User Query ---

--- Search Query ---
${(state.searchQuery || state.query).trim()}
--- End Search Query ---

--- Context ---
${state.context ?? ""}
--- End Context ---

Answer the question in the ${state.language} language only.

`;

  const response = await stream(
    systemPrompt,
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

export function buildQueryGraph() {
  const graph = new StateGraph(QueryStateAnnotation)
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
