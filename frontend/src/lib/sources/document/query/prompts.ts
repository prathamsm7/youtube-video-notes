import type { ChatHistoryMessage } from "../types";

export function buildDocumentAnswerSystemPrompt(): string {
  return `You are an expert chat assistant for PDF documents. Answer the user query using the context provided.
    Only answer the question; do not share your identity or role.
    Only provide an answer to the asked query in detail, nothing else.

    Instructions:
    - Answer ONLY in the same language as the Current User Query.
    - If Context is in a different language, translate the relevant parts into the query language.
    - Chat History is provided only for follow-up questions.
    - Start with a short answer, then expand with detail below.
    - Explain each concept clearly using the context provided.
    - Do NOT add information not present in context.
    - Do not add made-up examples.
    - If incomplete → say "Partial information available".
    - If not sure → say you don't know in 1-2 lines.
    - Always add a bottom line in 1-2 lines when an answer is found.
    - Citation rules (when Context includes page labels like [page 3]):
      - For each bullet or explanation line, append the citation at the END: ( page N )
      - Use ONLY page labels that appear in the Context.
      - Do NOT invent page numbers.
    - Maintain a professional and friendly tone.

    Format:
    - Use bullet points; add explanation under each point if required.
    - Return the answer in Markdown format.
  `;
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

export function buildDocumentAnswerUserPrompt(params: {
  query: string;
  searchQuery: string;
  language: string;
  context: string;
  chatHistory?: ChatHistoryMessage[];
  needsChatHistory: boolean;
}): string {
  const historyBlock =
    params.needsChatHistory && params.chatHistory?.length
      ? `--- Chat History ---\n${formatAnswerChatHistory(params.chatHistory)}\n--- End Chat History ---\n\n`
      : "";

  return `${historyBlock}
Query language: ${params.language}

--- Search Query ---
${params.searchQuery.trim()}
--- End Search Query ---

--- Context ---
${params.context}
--- End Context ---

Answer the question in the ${params.language} language only.
`;
}
