export type ChatHistoryMessage = {
  role: string;
  content: string;
};

export type QueryIntent = "SUMMARY" | "QA";

export type AnalyzeQueryResult = {
  intent: QueryIntent;
  search_query: string;
  language: string;
  needs_chat_history: boolean;
};

export type RetrieveContextResult = {
  context: string | null;
  chunkCount: number;
};

export type DocumentQueryStreamEvent =
  | {
      kind: "status";
      phase: "analyzing" | "retrieving" | "generating" | "summarizing";
      total_chunks?: number;
    }
  | { kind: "token"; content: string }
  | { kind: "meta"; payload: { intent: QueryIntent; summary_generated: boolean } };

export type DocumentIngestStreamEvent =
  | {
      type: "started";
      document_id: string;
      file_name: string;
    }
  | {
      type: "progress";
      status: string;
      total_chunks: number;
      processed_chunks: number;
    }
  | {
      type: "error";
      document_id: string;
      status: string;
      error: string;
      completed: boolean;
      total_chunks?: number;
    }
  | {
      type: "complete";
      document_id: string;
      status: string;
      total_chunks: number;
      processed_chunks: number;
      completed: boolean;
    };
