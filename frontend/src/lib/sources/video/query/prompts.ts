import type { ChatHistoryMessage } from "../types";

export function buildVideoAnswerSystemPrompt(): string {
  return `You are an expert chat assistant. Your task is to answer the user query using the context provided.
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

export function buildVideoAnswerUserPrompt(params: {
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
