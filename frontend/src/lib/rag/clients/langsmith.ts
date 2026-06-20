/** LangGraph run config for LangSmith (reads LANGSMITH_* from .env). */
export function traceConfig(
  name: string,
  meta?: { videoId?: string; chatId?: string; userId?: number },
) {
  return {
    runName: name,
    tags: [name],
    metadata: {
      ...(meta?.videoId && { video_id: meta.videoId }),
      ...(meta?.chatId && { chat_id: meta.chatId }),
      ...(meta?.userId && { user_id: String(meta.userId) }),
    },
    configurable: {
      thread_id: meta?.chatId ?? meta?.videoId ?? name,
    },
  };
}
