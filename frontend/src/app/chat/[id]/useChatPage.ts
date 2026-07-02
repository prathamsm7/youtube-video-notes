"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useChatList } from "@/context/ChatListContext";
import { useTheme } from "@/context/ThemeContext";
import type { ChatMessage } from "@/types/ui";
import { parseSseStream } from "./stream-chat-response";
import type { ApiMessage, ChatData, ChatMetaResponse } from "./types";
import { chatFromListItem, getStreamStatusLabel } from "./utils";
import { isNotionFeatureEnabled } from "@/lib/features";

export function useChatPage() {
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
          msgData.messages.map((m: ApiMessage) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        );

        if (!listItem) {
          const metaRes = await apiFetch(`/api/chats/${selectedChatId}`);
          if (activeChatIdRef.current !== selectedChatId) return;
          if (metaRes.ok) {
            const meta = (await metaRes.json()) as ChatMetaResponse;
            const isDocument = meta.sourceType === "pdf";
            setChat({
              id: meta.id,
              title: meta.title,
              updatedAt: meta.updatedAt,
              sourceType: isDocument ? "pdf" : "video",
              sourceStatus: isDocument
                ? (meta.document?.status ?? "PENDING")
                : (meta.video?.status ?? "PENDING"),
              youtubeId: meta.video?.youtubeId ?? null,
              documentFileName: meta.document?.fileName ?? null,
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
    if (!user || !chatId) return;
    refreshChats();
  }, [user, chatId, refreshChats]);

  useEffect(() => {
    if (!user || !chatId || chatsLoading) return;
    loadMessages(chatId);
  }, [user, chatId, chatsLoading, loadMessages]);

  useEffect(() => {
    if (!user || !isNotionFeatureEnabled()) return;
    apiFetch("/api/notion/status")
      .then((res) => res.json())
      .then((data) => setNotionConnected(data.connected))
      .catch(() => setNotionConnected(false));
  }, [user, apiFetch]);

  const handleSaveToNotion = async (msg: ChatMessage) => {
    if (!isNotionFeatureEnabled()) return;
    if (!chat) return;
    setSavingToNotion(msg.id);
    try {
      const msgIndex = messages.findIndex((m) => m.id === msg.id);
      const question = msgIndex > 0 ? messages[msgIndex - 1].content : chat.title;

      const body =
        chat.sourceType === "pdf"
          ? {
              documentTitle: chat.documentFileName ?? chat.title,
              question,
              answer: msg.content,
            }
          : {
              videoId: chat.youtubeId,
              videoTitle: chat.title,
              question,
              answer: msg.content,
            };

      const res = await apiFetch("/api/notion/save-chat", {
        method: "POST",
        body: JSON.stringify(body),
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

    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, role: "user", content: userMessage },
    ]);
    setIsTyping(true);
    setStreamingMessageId(null);

    const assistantId = `temp-${Date.now() + 1}`;
    let assistantStarted = false;
    let content = "";

    const ensureAssistantMessage = () => {
      if (assistantStarted) return;
      assistantStarted = true;
      setIsTyping(false);
      setStreamingMessageId(assistantId);
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);
    };

    try {
      const res = await apiFetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: userMessage }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to get an answer");
      }

      if (!res.body) throw new Error("Streaming not supported");

      for await (const event of parseSseStream(res.body)) {
        if (event.type === "started") {
          ensureAssistantMessage();
        } else if (event.type === "status") {
          ensureAssistantMessage();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    streamStatus: getStreamStatusLabel({
                      phase: event.phase,
                      totalChunks: event.total_chunks,
                    }),
                  }
                : m,
            ),
          );
        } else if (event.type === "token") {
          ensureAssistantMessage();
          content += event.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content, streamStatus: undefined } : m,
            ),
          );
        } else if (event.type === "error") {
          throw new Error(event.error);
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

  const youtubeId =
    chat?.youtubeId ?? chats.find((c) => c.id === chatId)?.youtubeId ?? null;

  return {
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
  };
}
