import type { AnalyzeQueryResult, ChatHistoryMessage } from "../types";
import { generateWithFallback } from "../ai-handler";
import { CHAT_MODEL_FAST, CHAT_MODEL_STRONG } from "../constants";

function formatChatHistory(chatHistory: ChatHistoryMessage[]): string {
  return chatHistory
    .slice(-6)
    .map((msg) => `${msg.role.charAt(0).toUpperCase()}${msg.role.slice(1)}: ${msg.content}`)
    .join("\n");
}

const SUMMARY_PATTERN =
  /\b(summarize|summary|summarise|overview|recap|tl;?dr|main points|key points|gist|highlights)\b/i;

function resolveIntent(query: string): "SUMMARY" | "QA" {
  if (SUMMARY_PATTERN.test(query.trim())) {
    return "SUMMARY";
  }
  return "QA";
}

function detectQueryLanguage(query: string): string {
  if (/[\u0900-\u097F]/.test(query)) {
    return "Hindi";
  }
  return "English";
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

  const intent = resolveIntent(query);
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

export async function analyzeQuery(
  query: string,
  chatHistory: ChatHistoryMessage[] = [],
): Promise<AnalyzeQueryResult> {
  const historyStr = formatChatHistory(chatHistory);
  const historyBlock = historyStr
    ? `Chat History:\n${historyStr}\n\n`
    : "Chat History: (none)\n\n";

  const systemPrompt = `Route this video chat query.

Intent rules:
- SUMMARY: ONLY when the user explicitly asks for a full-video overview (summarize, recap, main points, etc.)
- QA: ANY specific question about the video — what/how/why/which/step/part/compare/explain a topic
- When unsure → QA

SUMMARY examples:
- "summarize this video" → {"intent":"SUMMARY","search_query":"summarize this video","language":"English","needs_chat_history":false}
- "give me the main points" → {"intent":"SUMMARY","search_query":"give me the main points","language":"English","needs_chat_history":false}

QA examples:
- "what is the second step in transformer architecture" → {"intent":"QA","search_query":"second step in transformer architecture","language":"English","needs_chat_history":false}
- "how does attention work" → {"intent":"QA","search_query":"how attention mechanism works","language":"English","needs_chat_history":false}
- "explain it simpler" (with prior chat about transformers) → {"intent":"QA","search_query":"transformer architecture explained simply","language":"English","needs_chat_history":false}

needs_chat_history examples:
- "shorten your last answer" → {"intent":"QA","search_query":"shorten your last answer","language":"English","needs_chat_history":true}
- "explain your second bullet" → {"intent":"QA","search_query":"explain your second bullet","language":"English","needs_chat_history":true}
- "you said X, is that correct?" → {"intent":"QA","search_query":"you said X, is that correct?","language":"English","needs_chat_history":true}

Return JSON only:
- intent: "SUMMARY" or "QA"
- search_query: standalone phrase for vector search; resolve pronouns from chat history when needed; do not change meaning
- language: language of the latest user query (e.g. "English", "Hindi")
- needs_chat_history: true only if the answer requires prior chat turns to understand the query`;


  const userPrompt = `${historyBlock}Latest User Query: ${query}`;

  try {
    const raw = await generateWithFallback(
      systemPrompt,
      userPrompt,
      CHAT_MODEL_FAST,
      CHAT_MODEL_STRONG,
      0,
    );
    return parseRouterJson(raw, query, chatHistory);
  } catch (error) {
    console.warn("Query analysis error:", error);
    return {
      intent: resolveIntent(query),
      search_query: query.trim(),
      language: detectQueryLanguage(query),
      needs_chat_history: chatHistory.length > 0,
    };
  }
}
