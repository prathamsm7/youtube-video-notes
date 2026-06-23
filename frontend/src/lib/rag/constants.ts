
export const WINDOW_SECONDS = 180;
export const OVERLAP_RATIO = 0.1667; // 30s overlap on 180s windows
export const STEP_SECONDS = WINDOW_SECONDS * (1 - OVERLAP_RATIO);

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_BATCH_SIZE = 32;

/** Qdrant top-K passed to reranker */
export const RETRIEVAL_CANDIDATE_LIMIT = 10;
/** Chunks passed to the answer LLM after reranking */
export const RETRIEVAL_CHUNK_LIMIT = 5;

export const RERANKER_MODEL = "jina-reranker-v2-base-multilingual";

export const SUMMARY_MAP_CONCURRENCY = 5;
export const QDRANT_UPSERT_BATCH_SIZE = 100;

export const CHAT_MODEL_FAST = "gpt-4.1-nano-2025-04-14";
export const CHAT_MODEL_STRONG = "gpt-5.4-nano-2026-03-17";
export const CHAT_MODEL_ANSWER_PRIMARY = "gpt-5.4-mini";
export const CHAT_MODEL_ANSWER_FALLBACK = "gpt-4.1-mini";

export const STREAM_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;
