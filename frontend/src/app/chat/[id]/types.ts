import type { SourceType } from "@/types/ui";

export type ApiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ChatData = {
  id: string;
  title: string;
  updatedAt: string;
  sourceType: SourceType;
  sourceStatus: string;
  youtubeId?: string | null;
  documentFileName?: string | null;
};

export type StreamStatus = {
  phase: string;
  totalChunks?: number;
} | null;

export type ChatListItemShape = {
  id: string;
  title: string;
  sourceType: SourceType;
  videoTitle: string | null;
  youtubeId: string | null;
  videoStatus: string | null;
  documentFileName: string | null;
  documentStatus: string | null;
  updatedAt: string;
};

export type ChatMetaResponse = {
  id: string;
  title: string;
  updatedAt: string;
  sourceType: SourceType;
  video?: { youtubeId: string; status: string } | null;
  document?: { fileName: string; status: string } | null;
};
