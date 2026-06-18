export const WINDOW_SECONDS = 300;
export const OVERLAP_RATIO = 0.2;
export const STEP_SECONDS = WINDOW_SECONDS * (1 - OVERLAP_RATIO);

export const EMBEDDING_MODEL = "jina-embeddings-v3";
export const EMBEDDING_DIMENSIONS = 1024;
export const EMBEDDING_BATCH_SIZE = 32;
export const EMBEDDING_API_URL = "https://api.jina.ai/v1/embeddings";

export const CHAT_MODEL_FAST = "gemini-3.1-flash-lite-preview";
export const CHAT_MODEL_STRONG = "gemini-2.5-flash";
export const CHAT_MODEL_ANSWER_PRIMARY = "gemini-3-flash-preview";
export const CHAT_MODEL_ANSWER_FALLBACK = "gemini-2.5-pro";

export const STREAM_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;
