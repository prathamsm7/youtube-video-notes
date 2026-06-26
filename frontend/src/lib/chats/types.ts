import type { Document, Message, Video } from "@prisma/client";

export type ChatWithSources = {
  id: string;
  userId: number;
  videoId: string | null;
  documentId: string | null;
  title: string | null;
  updatedAt: Date;
  video: Video | null;
  document: Document | null;
};

export type ApiSourceType = "pdf" | "video";

export type ApiChatListItem = {
  id: string;
  title: string;
  sourceType: ApiSourceType;
  videoTitle: string | null;
  youtubeId: string | null;
  videoStatus: string | null;
  documentFileName: string | null;
  documentStatus: string | null;
  updatedAt: Date;
};

export type ApiChatDetail = {
  id: string;
  title: string;
  updatedAt: Date;
  sourceType: ApiSourceType;
  video: {
    id: string;
    youtubeId: string;
    title: string | null;
    status: Video["status"];
  } | null;
  document: {
    id: string;
    fileName: string;
    status: Document["status"];
  } | null;
};

export type ApiMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
};

export type { Message };
