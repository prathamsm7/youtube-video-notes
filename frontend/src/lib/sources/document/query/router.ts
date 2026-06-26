import type { AnalyzeQueryResult, ChatHistoryMessage } from "../types";
import { generateStructured } from "@/lib/core/ai-handler";
import {
  detectQueryLanguage,
  normalizeRouterResult,
  QUERY_ROUTER_RESPONSE_SCHEMA,
  type QueryRouterLlmResult,
} from "@/lib/core/rag/query-router-schema";
import { isOffTopicQuery } from "@/lib/core/rag/off-topic";
import { CHAT_MODEL_FAST } from "@/lib/core/rag/constants";

function formatChatHistory(chatHistory: ChatHistoryMessage[]): string {
  return chatHistory
    .slice(-6)
    .map((msg) => `${msg.role.charAt(0).toUpperCase()}${msg.role.slice(1)}: ${msg.content}`)
    .join("\n");
}

function buildSystemPrompt(): string {
  return `You are an expert query router, query rewriter and language detector for document Q&A.
Your task is to classify intent, rewrite the query for retrieval, detect language, and decide if chat history is required.

Search query rules:
- Maintain the meaning of the query.
- Rewrite, expand or rephrase the query if needed to make it more clear and concise.
- Use provided chat history to resolve pronouns and understand the context of the query.

Intent rules:
- SUMMARY: ONLY when the user explicitly asks for a full-document overview (summarize, recap, main points, etc.)
- OFF_TOPIC: Greetings, thanks, small talk, or vague social messages unrelated to the document (e.g. "hi", "how are you", "thanks")
- QA: ANY specific question about the document — what/how/why/which/section/table/chart/compare/explain a topic
- When unsure about content relevance → QA

OFF_TOPIC examples:
- "how are you" → intent OFF_TOPIC
- "hello" → intent OFF_TOPIC
- "thanks" → intent OFF_TOPIC

SUMMARY examples:
- "summarize this document" → intent SUMMARY
- "give me the main points" → intent SUMMARY

QA examples:
- "what does table 2 show" → intent QA
- "explain the chart on page 5" → intent QA
- "explain it simpler" (with prior chat) → intent QA, needs_chat_history true`;
}

export async function analyzeQuery(
  query: string,
  chatHistory: ChatHistoryMessage[] = [],
): Promise<AnalyzeQueryResult> {
  if (isOffTopicQuery(query)) {
    return {
      intent: "OFF_TOPIC",
      search_query: "",
      language: detectQueryLanguage(query),
      needs_chat_history: false,
    };
  }

  const historyStr = formatChatHistory(chatHistory);
  const historyBlock = historyStr
    ? `Chat History:\n${historyStr}\n\n`
    : "Chat History: (none)\n\n";

  const userPrompt = `${historyBlock}Latest User Query: ${query}`;

  const result = await generateStructured<QueryRouterLlmResult>(
    buildSystemPrompt(),
    userPrompt,
    QUERY_ROUTER_RESPONSE_SCHEMA,
    "document_query_router",
    CHAT_MODEL_FAST,
    0,
  );

  return normalizeRouterResult(result, query, chatHistory.length);
}
