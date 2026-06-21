import type { AnalyzeQueryResult, ChatHistoryMessage } from "../types";
import { generate } from "../ai-handler";
import { CHAT_MODEL_FAST } from "../constants";

const SUMMARY_PATTERN =
  /\b(summarize|summary|summarise|overview|recap|tl;?dr|main points|key points|gist|highlights)\b/i;

const FOLLOW_UP_PATTERN =
  /\b(that|it|this|those|these|above|previous|earlier|same|more)\b|explain (?:that |it )?(?:simpler|simply|easier)|tell me more|what about|in simpler terms|say (?:that |it )?again/i;

export function ruleBasedFilter(query: string): string | null {
  const q = query.trim();

  if (q.length < 3) {
    return "This query is too short. Please ask a specific question about the video.";
  }

  const conversationalPatterns = [
    /^(hi|hello|hey|test|testing)$/i,
    /^(how are you|what is up).*/i,
  ];

  for (const pattern of conversationalPatterns) {
    if (pattern.test(q)) {
      return "This query is too short or conversational. Please ask a specific question about the video.";
    }
  }

  return null;
}

function formatChatHistory(chatHistory: ChatHistoryMessage[]): string {
  return chatHistory
    .slice(-4)
    .map((msg) => `${msg.role.charAt(0).toUpperCase()}${msg.role.slice(1)}: ${msg.content}`)
    .join("\n");
}

export function detectQueryLanguage(query: string): string {
  if (/[\u0900-\u097F]/.test(query)) {
    return "Hindi";
  }
  return "English";
}

function isSummaryQuery(query: string): boolean {
  return SUMMARY_PATTERN.test(query.trim());
}

function needsLlmRouter(query: string, chatHistory: ChatHistoryMessage[]): boolean {
  if (!chatHistory.length) {
    return false;
  }
  return FOLLOW_UP_PATTERN.test(query.trim());
}

export function tryFastRoute(
  query: string,
  chatHistory: ChatHistoryMessage[] = [],
): AnalyzeQueryResult | null {
  const trimmed = query.trim();
  if (!trimmed || needsLlmRouter(trimmed, chatHistory)) {
    return null;
  }

  const language = detectQueryLanguage(trimmed);

  if (isSummaryQuery(trimmed)) {
    return {
      intent: "SUMMARY",
      search_query: trimmed,
      language,
      needs_chat_history: false,
    };
  }

  return {
    intent: "QA",
    search_query: trimmed,
    language,
    needs_chat_history: false,
  };
}

function parseRouterJson(
  raw: string,
  query: string,
  chatHistory: ChatHistoryMessage[],
): AnalyzeQueryResult {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
  }

  const data = JSON.parse(cleaned) as {
    intent?: string;
    search_query?: string;
    language?: string;
    needs_chat_history?: boolean;
  };

  const intent = String(data.intent ?? "").toUpperCase() === "SUMMARY" ? "SUMMARY" : "QA";
  const searchQuery = String(data.search_query ?? query).trim() || query;
  const language = String(data.language ?? detectQueryLanguage(query)).trim() || "English";
  const hasHistory = chatHistory.length > 0;

  return {
    intent,
    search_query: searchQuery,
    language,
    needs_chat_history: hasHistory && data.needs_chat_history === true,
  };
}

async function analyzeQueryWithLlm(
  query: string,
  chatHistory: ChatHistoryMessage[] = [],
): Promise<AnalyzeQueryResult> {
  const historyStr = formatChatHistory(chatHistory);
  const historyBlock = historyStr
    ? `Chat History:\n${historyStr}\n\n`
    : "Chat History: (none)\n\n";

  const systemPrompt = `Route this video chat query.

Return JSON only:
- intent: "SUMMARY" (whole-video overview) or "QA" (specific retrieval question)
- search_query: standalone phrase for vector search; resolve pronouns from history when needed
- language: language of the latest user query (e.g. "English", "Hindi")
- needs_chat_history: true only if the answer requires prior chat turns

{"intent":"QA","search_query":"...","language":"English","needs_chat_history":false}`;

  const userPrompt = `${historyBlock}Latest User Query: ${query}`;

  const raw = await generate(systemPrompt, userPrompt, CHAT_MODEL_FAST, 0);
  return parseRouterJson(raw, query, chatHistory);
}

export async function analyzeQuery(
  query: string,
  chatHistory: ChatHistoryMessage[] = [],
): Promise<AnalyzeQueryResult> {
  const fast = tryFastRoute(query, chatHistory);
  if (fast) {
    return fast;
  }

  try {
    return await analyzeQueryWithLlm(query, chatHistory);
  } catch (error) {
    console.warn("Query analysis error:", error);
    return {
      intent: "QA",
      search_query: query.trim(),
      language: detectQueryLanguage(query),
      needs_chat_history: chatHistory.length > 0,
    };
  }
}
