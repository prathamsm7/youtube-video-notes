import type { Message } from "@prisma/client";
import type { ApiChatDetail, ApiChatListItem, ApiMessage, ChatWithSources } from "./types";

function chatTitle(chat: ChatWithSources): string {
  return chat.title || chat.document?.fileName || chat.video?.title || "Untitled";
}

export function serializeMessage(message: Message): ApiMessage {
  return {
    id: message.id,
    role: message.role.toLowerCase(),
    content: message.content,
    createdAt: message.createdAt,
  };
}

export function serializeChatListItem(chat: ChatWithSources): ApiChatListItem {
  const isDocument = Boolean(chat.documentId && chat.document);

  return {
    id: chat.id,
    title: chatTitle(chat),
    sourceType: isDocument ? "pdf" : "video",
    videoTitle: chat.video?.title ?? null,
    youtubeId: chat.video?.youtubeId ?? null,
    videoStatus: chat.video?.status ?? null,
    documentFileName: chat.document?.fileName ?? null,
    documentStatus: chat.document?.status ?? null,
    updatedAt: chat.updatedAt,
  };
}

export function serializeChatDetail(chat: ChatWithSources): ApiChatDetail {
  const isDocument = Boolean(chat.documentId && chat.document);

  return {
    id: chat.id,
    title: chatTitle(chat),
    updatedAt: chat.updatedAt,
    sourceType: isDocument ? "pdf" : "video",
    video: chat.video
      ? {
          id: chat.video.id,
          youtubeId: chat.video.youtubeId,
          title: chat.video.title,
          status: chat.video.status,
        }
      : null,
    document: chat.document
      ? {
          id: chat.document.id,
          fileName: chat.document.fileName,
          status: chat.document.status,
        }
      : null,
  };
}
