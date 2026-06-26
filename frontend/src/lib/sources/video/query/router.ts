import type { AnalyzeQueryResult, ChatHistoryMessage } from "../types";
import { generateStructured } from "@/lib/core/ai-handler";
import {
  normalizeRouterResult,
  QUERY_ROUTER_RESPONSE_SCHEMA,
  type QueryRouterLlmResult,
} from "@/lib/core/rag/query-router-schema";
import { CHAT_MODEL_FAST } from "@/lib/core/rag/constants";

function formatChatHistory(chatHistory: ChatHistoryMessage[]): string {
  return chatHistory
    .slice(-6)
    .map((msg) => `${msg.role.charAt(0).toUpperCase()}${msg.role.slice(1)}: ${msg.content}`)
    .join("\n");
}

function buildSystemPrompt(): string {
  return `You are an expert query router, query rewriter and language detector.
Your task is to classify intent, rewrite the query for retrieval, detect language, and decide if chat history is required.

Search query rules:
- Maintain the meaning of the query.
- Rewrite, expand or rephrase the query if needed to make it more clear and concise.
- Use provided chat history to resolve pronouns and understand the context of the query.

Intent rules:
- SUMMARY: ONLY when the user explicitly asks for a full-video overview (summarize, recap, main points, etc.)
- QA: ANY specific question about the video — what/how/why/which/step/part/compare/explain a topic
- When unsure → QA

SUMMARY examples:
- "summarize this video" → intent SUMMARY
- "give me the main points" → intent SUMMARY

QA examples:
- "what is the second step in transformer architecture" → intent QA
- "how does attention work" → intent QA
- "explain it simpler" (with prior chat about transformers) → intent QA, needs_chat_history true

needs_chat_history examples:
- "shorten your last answer" → needs_chat_history true
- "explain your second bullet" → needs_chat_history true`;
}

export async function analyzeQuery(
  query: string,
  chatHistory: ChatHistoryMessage[] = [],
): Promise<AnalyzeQueryResult> {
  const historyStr = formatChatHistory(chatHistory);
  const historyBlock = historyStr
    ? `Chat History:\n${historyStr}\n\n`
    : "Chat History: (none)\n\n";

  const userPrompt = `${historyBlock}Latest User Query: ${query}`;

  const result = await generateStructured<QueryRouterLlmResult>(
    buildSystemPrompt(),
    userPrompt,
    QUERY_ROUTER_RESPONSE_SCHEMA,
    "video_query_router",
    CHAT_MODEL_FAST,
    0,
  );

  return normalizeRouterResult(result, query, chatHistory.length);
}
