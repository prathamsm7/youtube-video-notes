/** LangGraph run config for LangSmith (reads LANGSMITH_* from .env). */
export function traceConfig(
  name: string,
  meta?: {
    videoId?: string;
    documentId?: string;
    chatId?: string;
    userId?: number;
  },
  options?: { projectName?: string },
) {
  return {
    runName: name,
    tags: [name],
    metadata: {
      ...(meta?.videoId && { video_id: meta.videoId }),
      ...(meta?.documentId && { document_id: meta.documentId }),
      ...(meta?.chatId && { chat_id: meta.chatId }),
      ...(meta?.userId && { user_id: String(meta.userId) }),
      ...(options?.projectName && { langsmith_project: options.projectName }),
    },
    configurable: {
      thread_id: meta?.chatId ?? meta?.videoId ?? meta?.documentId ?? name,
    },
  };
}
