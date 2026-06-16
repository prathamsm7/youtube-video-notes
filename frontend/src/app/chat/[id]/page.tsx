"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Loader2, Send, Bot, User, Bookmark } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/AppHeader";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatData = {
  id: string;
  title: string;
  video: {
    youtubeId: string;
    title: string;
    status: string;
  };
  messages: Message[];
};

export default function ChatPage() {
  const { user, apiFetch, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const chatId = params.id as string;

  const [chat, setChat] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notionConnected, setNotionConnected] = useState(false);
  const [savingToNotion, setSavingToNotion] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const loadChat = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/chats/${chatId}`);
      if (!res.ok) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setChat(data);
      setMessages(data.messages);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, chatId, router]);

  useEffect(() => {
    if (user && chatId) loadChat();
  }, [user, chatId, loadChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/notion/status")
      .then((res) => res.json())
      .then((data) => setNotionConnected(data.connected))
      .catch(() => setNotionConnected(false));
  }, [user, apiFetch]);

  const handleSaveToNotion = async (msg: Message) => {
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chat) return;

    const userMessage = input.trim();
    setInput("");
    const tempUserId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempUserId, role: "user", content: userMessage }]);
    setIsTyping(true);

    try {
      const res = await apiFetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: userMessage }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to get an answer");
      }

      setIsTyping(false);
      const assistantId = `temp-${Date.now() + 1}`;
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let content = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content } : m)),
          );
        }
      }

      await loadChat();
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
    }
  };

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!chat) return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <AppHeader notionConnected={notionConnected} onLogout={logout} />

      <div className="pt-20 px-4 max-w-3xl mx-auto w-full flex-1 flex flex-col pb-28">
        <div className="mb-4 pb-4 border-b border-white/10">
          <h1 className="text-lg font-semibold truncate">{chat.title || chat.video.title}</h1>
          <p className="text-sm text-neutral-500 truncate">{chat.video.title}</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "user" ? "bg-neutral-800" : "bg-purple-600"
                }`}
              >
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 relative group ${
                  msg.role === "user"
                    ? "bg-neutral-800"
                    : "bg-neutral-900 border border-white/5 prose prose-invert max-w-none"
                }`}
              >
                {msg.role === "user" ? (
                  <p>{msg.content}</p>
                ) : (
                  <>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {notionConnected && msg.content && (
                      <button
                        onClick={() => handleSaveToNotion(msg)}
                        disabled={savingToNotion === msg.id}
                        className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10"
                      >
                        {savingToNotion === msg.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-neutral-900 border border-white/5 rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-950/90 border-t border-white/5">
        <form
          onSubmit={handleSendMessage}
          className="max-w-3xl mx-auto flex gap-2 bg-neutral-900 border border-white/10 rounded-xl p-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this video..."
            disabled={isTyping || chat.video.status !== "READY"}
            className="flex-1 bg-transparent outline-none px-3 text-white placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="bg-white text-black p-2 rounded-lg disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
