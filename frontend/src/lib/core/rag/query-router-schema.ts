import { isOffTopicQuery } from "./off-topic";

export const QUERY_ROUTER_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["SUMMARY", "QA", "OFF_TOPIC"],
      description:
        "SUMMARY only when the user explicitly asks for a full-source overview (summarize, recap, main points, etc.). OFF_TOPIC for greetings, thanks, small talk, or vague social messages unrelated to the content. Otherwise QA.",
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

export type QueryIntent = "SUMMARY" | "QA" | "OFF_TOPIC";

export type QueryRouterLlmResult = {
  intent: QueryIntent;
  search_query: string;
  language: string;
  needs_chat_history: boolean;
};

const SUMMARY_PATTERN =
  /\b(summarize|summary|summarise|overview|recap|tl;?dr|main points|key points|gist|highlights)\b/i;

/** Conservative gate: full-summary path only for explicit overview requests. */
export function resolveIntent(query: string): QueryIntent {
  if (isOffTopicQuery(query)) {
    return "OFF_TOPIC";
  }
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
  if (regexIntent === "OFF_TOPIC" || result.intent === "OFF_TOPIC") {
    return {
      intent: "OFF_TOPIC",
      search_query: "",
      language: result.language.trim() || detectQueryLanguage(query),
      needs_chat_history: false,
    };
  }

  const intent =
    regexIntent === "SUMMARY" && result.intent === "SUMMARY" ? "SUMMARY" : "QA";

  return {
    intent,
    search_query: result.search_query.trim() || query.trim(),
    language: result.language.trim() || detectQueryLanguage(query),
    needs_chat_history: chatHistoryLength > 0 && result.needs_chat_history === true,
  };
}

