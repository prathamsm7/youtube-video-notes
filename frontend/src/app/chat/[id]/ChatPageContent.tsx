"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ConversationPage } from "@/components/docuvision/ConversationPage";
import type { ChatListItem } from "@/context/ChatListContext";
import type { ChatMessage, SourceInfo } from "@/types/ui";
import type { ChatData } from "./types";

type ChatPageContentProps = {
  chat: ChatData | null;
  chatId: string;
  chats: ChatListItem[];
  chatsLoading: boolean;
  messages: ChatMessage[];
  messagesLoading: boolean;
  isTyping: boolean;
  streamingMessageId: string | null;
  notionConnected: boolean;
  savingToNotion: string | null;
  isDark: boolean;
  toggleTheme: () => void;
  userEmail: string;
  logout: () => void;
  onSendMessage: (content: string) => void;
  onSelectChat: (id: string) => void;
  onSaveToNotion: (msg: ChatMessage) => void;
};

export function ChatPageContent({
  chat,
  chatId,
  chats,
  chatsLoading,
  messages,
  messagesLoading,
  isTyping,
  streamingMessageId,
  notionConnected,
  savingToNotion,
  isDark,
  toggleTheme,
  userEmail,
  logout,
  onSendMessage,
  onSelectChat,
  onSaveToNotion,
}: ChatPageContentProps) {
  const router = useRouter();
  const listItem = chats.find((c) => c.id === chatId);
  const resolvedSourceType = chat?.sourceType ?? listItem?.sourceType;

  const sources: SourceInfo[] = chats.map((c) => ({
    id: c.id,
    type: c.sourceType,
    title: c.title || c.videoTitle || c.documentFileName || "Untitled",
    dateAdded: c.updatedAt,
    youtubeId: c.youtubeId ?? undefined,
    fileName: c.documentFileName ?? undefined,
  }));

  const activeSource: SourceInfo = chat
    ? {
        id: chat.id,
        type: chat.sourceType,
        title: chat.title,
        dateAdded: chat.updatedAt,
        youtubeId: chat.youtubeId ?? undefined,
        fileName: chat.documentFileName ?? undefined,
      }
    : {
        id: chatId,
        type: resolvedSourceType ?? "pdf",
        title:
          listItem?.title ??
          listItem?.videoTitle ??
          listItem?.documentFileName ??
          "Loading...",
        dateAdded: listItem?.updatedAt ?? new Date().toISOString(),
        youtubeId: listItem?.youtubeId ?? undefined,
        fileName: listItem?.documentFileName ?? undefined,
      };

  return (
    <ConversationPage
      source={activeSource}
      sources={sources}
      messages={messages}
      isThinking={isTyping}
      streamingMessageId={streamingMessageId}
      messagesLoading={messagesLoading}
      chatsLoading={chatsLoading}
      onSendMessage={onSendMessage}
      onNewChat={() => router.push("/")}
      onSelectSource={onSelectChat}
      isDark={isDark}
      onThemeToggle={toggleTheme}
      userEmail={userEmail}
      onLogout={logout}
      inputDisabled={!chat || chat.sourceStatus !== "READY"}
      notionConnected={notionConnected}
      onSaveToNotion={onSaveToNotion}
      savingToNotionId={savingToNotion}
      showVideoPanel={resolvedSourceType === "video"}
    />
  );
}
