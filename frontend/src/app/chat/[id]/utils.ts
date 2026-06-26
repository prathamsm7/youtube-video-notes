import type { ChatData, ChatListItemShape, StreamStatus } from "./types";

export function getStreamStatusLabel(status: StreamStatus): string {
  if (!status) return "";

  switch (status.phase) {
    case "analyzing":
      return "Understanding and analysing question";
    case "retrieving":
      return status.totalChunks !== undefined
        ? `Retrieved ${status.totalChunks} chunks`
        : "Retrieving chunks...";
    case "generating":
      return "Generating answer";
    case "summarizing":
      return "Generating summary";
    default:
      return "";
  }
}

export function chatFromListItem(item: ChatListItemShape): ChatData {
  const isDocument = item.sourceType === "pdf";
  return {
    id: item.id,
    title: item.title,
    updatedAt: item.updatedAt,
    sourceType: item.sourceType,
    sourceStatus: isDocument
      ? (item.documentStatus ?? "PENDING")
      : (item.videoStatus ?? "PENDING"),
    youtubeId: item.youtubeId,
    documentFileName: item.documentFileName,
  };
}
