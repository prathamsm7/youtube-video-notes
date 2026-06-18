import type { AnalyzeQueryResult, ChatHistoryMessage } from "../types";
import { generateWithFallback } from "../ai-handler";
import { CHAT_MODEL_FAST, CHAT_MODEL_STRONG } from "../constants";

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
    .slice(-6)
    .map((msg) => `${msg.role.charAt(0).toUpperCase()}${msg.role.slice(1)}: ${msg.content}`)
    .join("\n");
}

export async function analyzeQuery(
  query: string,
  chatHistory: ChatHistoryMessage[] = [],
): Promise<AnalyzeQueryResult> {
  const historyStr = formatChatHistory(chatHistory);
  const historyBlock = historyStr
    ? `Chat History:\n${historyStr}\n\n`
    : "Chat History: (none)\n\n";

  const prompt = `
                    You are understanding the intent of a user's query and routing it to the appropriate service.

                    ${historyBlock}
                    Latest User Query: ${query}

                    Tasks:
                    1. Classify intent as SUMMARY or QA.
                    - SUMMARY: user wants a general overview or summary of the whole video
                    - QA: user asks a specific question that needs retrieval from the video

                    2. Set search_query for vector search.
                    - If QA: rewrite into a standalone search phrase (use chat history to resolve pronouns)
                    - If SUMMARY: use the latest query as-is

                    Output ONLY valid JSON, no markdown:
                    {"intent": "SUMMARY" or "QA", "search_query": "..."}
            `;

  try {
    const raw = await generateWithFallback(prompt, CHAT_MODEL_FAST, CHAT_MODEL_STRONG, 0);
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    }

    const data = JSON.parse(cleaned) as { intent?: string; search_query?: string };
    const intent = String(data.intent ?? "").toUpperCase() === "SUMMARY" ? "SUMMARY" : "QA";
    const searchQuery = String(data.search_query ?? query).trim() || query;
    return { intent, search_query: searchQuery };
  } catch (error) {
    console.warn("Query analysis error:", error);
    return { intent: "QA", search_query: query };
  }
}
