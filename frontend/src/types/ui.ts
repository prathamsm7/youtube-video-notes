export type SourceType = "pdf" | "video";

export interface SourceInfo {
  id: string;
  type: SourceType;
  title: string;
  url?: string;
  fileName?: string;
  dateAdded: string;
  youtubeId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  streamStatus?: string;
}
