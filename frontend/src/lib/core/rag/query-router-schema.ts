export const QUERY_ROUTER_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["SUMMARY", "QA"],
      description:
        "SUMMARY only when the user explicitly asks for a full-source overview (summarize, recap, main points, etc.). Otherwise QA.",
    },
    search_query: {
      type: "string",
      description:
        "Standalone rewritten phrase for vector search. Resolve pronouns from chat history when needed.",
    },
    language: {
      type: "string",
      description: 'Language of the latest user query, e.g. "English" or "Hindi".',
    },
    needs_chat_history: {
      type: "boolean",
      description:
        "True only if the query cannot be understood without prior chat turns.",
    },
  },
  required: ["intent", "search_query", "language", "needs_chat_history"],
  additionalProperties: false,
} as const;

export type QueryRouterLlmResult = {
  intent: "SUMMARY" | "QA";
  search_query: string;
  language: string;
  needs_chat_history: boolean;
};

const SUMMARY_PATTERN =
  /\b(summarize|summary|summarise|overview|recap|tl;?dr|main points|key points|gist|highlights)\b/i;

/** Conservative gate: full-summary path only for explicit overview requests. */
export function resolveIntent(query: string): "SUMMARY" | "QA" {
  if (SUMMARY_PATTERN.test(query.trim())) {
    return "SUMMARY";
  }
  return "QA";
}

export function detectQueryLanguage(query: string): string {
  if (/[\u0900-\u097F]/.test(query)) {
    return "Hindi";
  }
  return "English";
}

export function normalizeRouterResult(
  result: QueryRouterLlmResult,
  query: string,
  chatHistoryLength: number,
): QueryRouterLlmResult {
  const regexIntent = resolveIntent(query);
  const intent =
    regexIntent === "SUMMARY" && result.intent === "SUMMARY" ? "SUMMARY" : "QA";

  return {
    intent,
    search_query: result.search_query.trim() || query.trim(),
    language: result.language.trim() || detectQueryLanguage(query),
    needs_chat_history: chatHistoryLength > 0 && result.needs_chat_history === true,
  };
}

export function fallbackRouterResult(
  query: string,
  chatHistoryLength: number,
): QueryRouterLlmResult {
  return {
    intent: resolveIntent(query),
    search_query: query.trim(),
    language: detectQueryLanguage(query),
    needs_chat_history: false,
  };
}
