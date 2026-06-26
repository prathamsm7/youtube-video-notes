"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { VideoPlayerProvider } from "@/context/VideoPlayerContext";
import { AppShell } from "@/components/docuvision/AppShell";
import { ChatPageContent } from "./ChatPageContent";
import { useChatPage } from "./useChatPage";

export default function ChatPage() {
  const {
    user,
    authLoading,
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
    logout,
    youtubeId,
    handleSendMessage,
    handleSelectChat,
    handleSaveToNotion,
  } = useChatPage();

  if (authLoading || !user) {
    return (
      <div className="h-dvh bg-[#030712] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <AppShell fixedViewport>
      <VideoPlayerProvider youtubeId={youtubeId}>
        <ChatPageContent
          chat={chat}
          chatId={chatId}
          chats={chats}
          chatsLoading={chatsLoading}
          messages={messages}
          messagesLoading={messagesLoading}
          isTyping={isTyping}
          streamingMessageId={streamingMessageId}
          notionConnected={notionConnected}
          savingToNotion={savingToNotion}
          isDark={isDark}
          toggleTheme={toggleTheme}
          userEmail={user.email}
          logout={logout}
          onSendMessage={handleSendMessage}
          onSelectChat={handleSelectChat}
          onSaveToNotion={handleSaveToNotion}
        />
      </VideoPlayerProvider>
    </AppShell>
  );
}
