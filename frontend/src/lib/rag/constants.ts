// export const WINDOW_SECONDS = 300;
// export const OVERLAP_RATIO = 0.2;
export const WINDOW_SECONDS = 180;
export const OVERLAP_RATIO = 0.1667; // Equivalent to 30s / 180s (1/6th)
export const STEP_SECONDS = WINDOW_SECONDS * (1 - OVERLAP_RATIO);

export const EMBEDDING_MODEL = "jina-embeddings-v3";
export const EMBEDDING_DIMENSIONS = 1024;
export const EMBEDDING_BATCH_SIZE = 32;
export const EMBEDDING_API_URL = "https://api.jina.ai/v1/embeddings";

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
