export type TranscriptSegment = {
  text: string;
  start: number;
  end: number;
};

export type TextChunk = {
  /** Pure text — used for embedding only */
  text: string;
  /** Timestamp-labeled transcript lines — passed to the LLM */
  contextText: string;
  startSeconds: number;
  endSeconds: number;
  chunkIndex: number;
};

export type ChatHistoryMessage = {
  role: string;
  content: string;
};

export type QueryIntent = "SUMMARY" | "QA";

export type AnalyzeQueryResult = {
  intent: QueryIntent;
  search_query: string;
};

export type RetrieveContextResult = {
  context: string | null;
  chunkCount: number;
};

export type QueryStreamEvent =
  | {
      kind: "status";
      phase: "analyzing" | "retrieving" | "generating" | "summarizing";
      total_chunks?: number;
    }
  | { kind: "token"; content: string }
  | { kind: "meta"; payload: { intent: QueryIntent; summary_generated: boolean } };

export type IngestStreamEvent =
  | {
      type: "progress";
      status: string;
      total_chunks: number;
      processed_chunks: number;
    }
  | {
      type: "error";
      video_id: string;
      status: string;
      error: string;
      completed: boolean;
      total_chunks?: number;
    }
  | {
      type: "complete";
      video_id: string;
      status: string;
      total_chunks: number;
      processed_chunks: number;
      completed: boolean;
    };
