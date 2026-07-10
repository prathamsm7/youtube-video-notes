export const WINDOW_SECONDS = 300; // 2 min windows
export const OVERLAP_SECONDS = 30;
export const STEP_SECONDS = WINDOW_SECONDS - OVERLAP_SECONDS; // 105s step

/** Qdrant top-K passed to reranker (tuned for 2-min chunks). */
export const VIDEO_RETRIEVAL_CANDIDATE_LIMIT = 10;
/** Chunks passed to the answer LLM after reranking. */
export const VIDEO_RETRIEVAL_CHUNK_LIMIT = 3;
