export type DocumentPage = {
  pageNumber: number;
  text: string;
};

export type DocumentTextChunk = {
  text: string;
  contextText: string;
  pageNumber: number;
  chunkIndex: number;
};

export type ChatHistoryMessage = {
  role: string;
  content: string;
};

export type QueryIntent = "SUMMARY" | "QA";

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
