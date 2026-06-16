"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, PlayCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/AppHeader";

type ChatItem = {
  id: string;
  title: string;
  videoTitle: string;
  updatedAt: string;
  lastMessage: string | null;
};

type JobStatus = "idle" | "extracting" | "chunking" | "embedding" | "processing" | "completed" | "failed";

export default function HomePage() {
  const { user, apiFetch, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [url, setUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobPhase, setJobPhase] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notionConnected, setNotionConnected] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const loadChats = useCallback(async () => {
    try {
      const res = await apiFetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats);
      }
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    if (user) loadChats();
  }, [user, loadChats]);

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/notion/status")
      .then((res) => res.json())
      .then((data) => setNotionConnected(data.connected))
      .catch(() => setNotionConnected(false));
  }, [user, apiFetch]);

  const handleProcessVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsProcessing(true);
    setJobPhase("extracting");
    setError(null);
    setProgress({ processed: 0, total: 0 });

    try {
      const res = await apiFetch("/api/videos/process/stream", {
        method: "POST",
        body: JSON.stringify({ youtube_url: url }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to process video");
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
          const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          const payload = JSON.parse(dataLine.slice(6));

          if (payload.type === "started") {
            setJobPhase("extracting");
          } else if (payload.type === "progress" && payload.status) {
            setJobPhase(payload.status as JobStatus);
            if (payload.total_chunks) {
              setProgress({
                processed: payload.processed_chunks || 0,
                total: payload.total_chunks,
              });
            }
          } else if (payload.type === "complete" && payload.chatId) {
            router.push(`/chat/${payload.chatId}`);
            return;
          } else if (payload.type === "error") {
            setError(payload.error || "Processing failed");
            setJobPhase("failed");
            setIsProcessing(false);
            return;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setJobPhase("failed");
      setIsProcessing(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <AppHeader notionConnected={notionConnected} onLogout={logout} />

      <main className="pt-24 px-4 max-w-3xl mx-auto pb-12">
        <h1 className="text-3xl font-bold mb-2">Your chats</h1>
        <p className="text-neutral-400 mb-8">Pick a past conversation or analyze a new video.</p>

        {chats.length > 0 && (
          <div className="space-y-2 mb-10">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => router.push(`/chat/${chat.id}`)}
                className="w-full text-left p-4 rounded-xl border border-white/10 bg-neutral-900 hover:bg-neutral-800 transition flex items-start gap-3"
              >
                <MessageSquare className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{chat.title || chat.videoTitle}</p>
                  {chat.lastMessage && (
                    <p className="text-sm text-neutral-500 truncate mt-1">{chat.lastMessage}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="border border-white/10 rounded-2xl p-6 bg-neutral-900">
          <h2 className="text-lg font-semibold mb-4">New video</h2>

          {isProcessing ? (
            <div className="text-center py-8 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-purple-500 mx-auto" />
              <p className="text-neutral-300 capitalize">{jobPhase}...</p>
              {progress.total > 0 && (
                <p className="text-sm text-neutral-500">
                  {progress.processed} / {progress.total} chunks
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleProcessVideo} className="flex gap-2">
              <div className="pl-3 flex items-center text-neutral-500">
                <PlayCircle className="w-5 h-5" />
              </div>
              <input
                type="url"
                required
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-transparent outline-none text-white placeholder:text-neutral-600"
              />
              <button
                type="submit"
                className="bg-white text-black px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                Analyze <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        </div>
      </main>
    </div>
  );
}
