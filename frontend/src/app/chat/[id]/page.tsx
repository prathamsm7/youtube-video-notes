"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChatList } from "@/context/ChatListContext";
import { useTheme } from "@/context/ThemeContext";
import { VideoPlayerProvider } from "@/context/VideoPlayerContext";
import { AppShell } from "@/components/docuvision/AppShell";
import { ConversationPage } from "@/components/docuvision/ConversationPage";
import { ChatMessage, SourceInfo } from "@/types/ui";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatData = {
  id: string;
  title: string;
  updatedAt: string;
  video: {
    youtubeId: string;
    title: string;
    status: string;
  };
};

type StreamStatus = {
  phase: string;
  totalChunks?: number;
} | null;

function getStreamStatusLabel(status: StreamStatus): string {
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

function chatFromListItem(item: {
  id: string;
  title: string;
  videoTitle: string;
  youtubeId: string;
  videoStatus: string;
  updatedAt: string;
}): ChatData {
  return {
    id: item.id,
    title: item.title,
    updatedAt: item.updatedAt,
    video: {
      youtubeId: item.youtubeId,
      title: item.videoTitle,
      status: item.videoStatus,
    },
  };
}

export default function ChatPage() {
  const { user, apiFetch, logout, isLoading: authLoading } = useAuth();
  const { chats, chatsLoading, refreshChats } = useChatList();
  const { isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const chatId = params.id as string;

  const [chat, setChat] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [notionConnected, setNotionConnected] = useState(false);
  const [savingToNotion, setSavingToNotion] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const activeChatIdRef = useRef(chatId);
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const loadMessages = useCallback(
    async (selectedChatId: string) => {
      activeChatIdRef.current = selectedChatId;
      setMessagesLoading(true);
      setMessages([]);

      const listItem = chatsRef.current.find((c) => c.id === selectedChatId);
      if (listItem) {
        setChat(chatFromListItem(listItem));
      } else {
        setChat(null);
      }

      try {
        const msgRes = await apiFetch(`/api/chats/${selectedChatId}/messages`);

        if (activeChatIdRef.current !== selectedChatId) return;

        if (!msgRes.ok) {
          if (msgRes.status === 404) {
            router.push("/");
          }
          return;
        }

        const msgData = await msgRes.json();
        if (activeChatIdRef.current !== selectedChatId) return;

        setMessages(
          msgData.messages.map((m: Message) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        );

        if (!listItem) {
          const metaRes = await apiFetch(`/api/chats/${selectedChatId}`);
          if (activeChatIdRef.current !== selectedChatId) return;
          if (metaRes.ok) {
            const meta = await metaRes.json();
            setChat({
              id: meta.id,
              title: meta.title,
              updatedAt: meta.updatedAt,
              video: {
                youtubeId: meta.video.youtubeId,
                title: meta.video.title,
                status: meta.video.status,
              },
            });
          }
        }
      } catch {
        if (activeChatIdRef.current === selectedChatId) {
          router.push("/");
        }
      } finally {
        if (activeChatIdRef.current === selectedChatId) {
          setMessagesLoading(false);
        }
      }
    },
    [apiFetch, router],
  );

  useEffect(() => {
    if (!user || !chatId || chatsLoading) return;
    loadMessages(chatId);
  }, [user, chatId, chatsLoading, loadMessages]);

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/notion/status")
      .then((res) => res.json())
      .then((data) => setNotionConnected(data.connected))
      .catch(() => setNotionConnected(false));
  }, [user, apiFetch]);

  const handleSaveToNotion = async (msg: ChatMessage) => {
    if (!chat) return;
    setSavingToNotion(msg.id);
    try {
      const msgIndex = messages.findIndex((m) => m.id === msg.id);
      const question = msgIndex > 0 ? messages[msgIndex - 1].content : chat.video.title;

      const res = await apiFetch("/api/notion/save-chat", {
        method: "POST",
        body: JSON.stringify({
          videoId: chat.video.youtubeId,
          videoTitle: chat.video.title,
          question,
          answer: msg.content,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to save");
      }
      alert("Saved to Notion!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingToNotion(null);
    }
  };

  const handleSendMessage = async (userMessage: string) => {
    if (!chat || messagesLoading) return;

    const tempUserId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: userMessage },
    ]);
    setIsTyping(true);
    setStreamingMessageId(null);

    const assistantId = `temp-${Date.now() + 1}`;
    let assistantStarted = false;
    let content = "";

    try {
      const res = await apiFetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: userMessage }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to get an answer");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("Streaming not supported");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const rawEvent of events) {
          const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;

          const payload = JSON.parse(dataLine.slice(6)) as {
            type?: string;
            phase?: string;
            total_chunks?: number;
            content?: string;
            error?: string;
          };

          if (payload.type === "started") {
            setIsTyping(false);
            assistantStarted = true;
            setStreamingMessageId(assistantId);
            setMessages((prev) => [
              ...prev,
              { id: assistantId, role: "assistant", content: "", streamStatus: undefined },
            ]);
          } else if (payload.type === "status" && payload.phase) {
            if (!assistantStarted) {
              setIsTyping(false);
              assistantStarted = true;
              setStreamingMessageId(assistantId);
              setMessages((prev) => [
                ...prev,
                { id: assistantId, role: "assistant", content: "" },
              ]);
            }
            const status: StreamStatus = {
              phase: payload.phase,
              totalChunks: payload.total_chunks,
            };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, streamStatus: getStreamStatusLabel(status) }
                  : m,
              ),
            );
          } else if (payload.type === "token" && payload.content) {
            if (!assistantStarted) {
              setIsTyping(false);
              assistantStarted = true;
              setStreamingMessageId(assistantId);
              setMessages((prev) => [
                ...prev,
                { id: assistantId, role: "assistant", content: "" },
              ]);
            }
            content += payload.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content, streamStatus: undefined } : m,
              ),
            );
          } else if (payload.type === "error") {
            throw new Error(payload.error || "Failed to generate response");
          }
        }
      }

      if (!assistantStarted) setIsTyping(false);
      await refreshChats();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `**Error:** ${err instanceof Error ? err.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setIsTyping(false);
      setStreamingMessageId(null);
    }
  };

  const handleSelectChat = (id: string) => {
    if (id === chatId) return;
    router.push(`/chat/${id}`);
  };

  if (authLoading || !user) {
    return (
      <div className="h-dvh bg-[#030712] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const sources: SourceInfo[] = chats.map((c) => ({
    id: c.id,
    type: "video",
    title: c.title || c.videoTitle,
    dateAdded: c.updatedAt,
  }));

  const listItem = chats.find((c) => c.id === chatId);
  const activeSource: SourceInfo = chat
    ? {
        id: chat.id,
        type: "video",
        title: chat.title || chat.video.title,
        dateAdded: chat.updatedAt,
      }
    : {
        id: chatId,
        type: "video",
        title: listItem?.title ?? listItem?.videoTitle ?? "Loading...",
        dateAdded: listItem?.updatedAt ?? new Date().toISOString(),
      };

  const youtubeId = chat?.video.youtubeId ?? listItem?.youtubeId ?? null;

  return (
    <AppShell fixedViewport>
      <VideoPlayerProvider youtubeId={youtubeId}>
        <ConversationPage
          source={activeSource}
          sources={sources}
          messages={messages}
          isThinking={isTyping}
          streamingMessageId={streamingMessageId}
          messagesLoading={messagesLoading}
          chatsLoading={chatsLoading}
          onSendMessage={handleSendMessage}
          onNewChat={() => router.push("/")}
          onSelectSource={handleSelectChat}
          isDark={isDark}
          onThemeToggle={toggleTheme}
          userEmail={user.email}
          onLogout={logout}
          inputDisabled={!chat || chat.video.status !== "READY"}
          notionConnected={notionConnected}
          onSaveToNotion={handleSaveToNotion}
          savingToNotionId={savingToNotion}
        />
      </VideoPlayerProvider>
    </AppShell>
  );
}
