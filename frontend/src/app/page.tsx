"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { AppShell } from "@/components/docuvision/AppShell";
import { LandingPage } from "@/components/docuvision/LandingPage";
import { ProcessingScreen } from "@/components/docuvision/ProcessingScreen";
import { SourceType } from "@/types/ui";

type JobStatus =
  | "idle"
  | "extracting"
  | "chunking"
  | "embedding"
  | "processing"
  | "completed"
  | "failed";

const VIDEO_STEPS = [
  "Downloading video transcript...",
  "Extracting keyframes...",
  "Generating semantic embeddings...",
  "Ready to chat!",
];

function jobPhaseToStep(phase: JobStatus): number {
  switch (phase) {
    case "extracting":
      return 0;
    case "chunking":
      return 1;
    case "embedding":
    case "processing":
      return 2;
    case "completed":
      return 3;
    default:
      return 0;
  }
}

export default function HomePage() {
  const { user, apiFetch, isLoading: authLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const router = useRouter();

  const [view, setView] = useState<"landing" | "processing">("landing");
  const [processingTitle, setProcessingTitle] = useState("");
  const [processingType, setProcessingType] = useState<SourceType>("video");
  const [jobPhase, setJobPhase] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const processVideo = async (youtubeUrl: string) => {
    setView("processing");
    setProcessingTitle(youtubeUrl);
    setProcessingType("video");
    setJobPhase("extracting");
    setError(null);
    setProgress({ processed: 0, total: 0 });

    try {
      const res = await apiFetch("/api/videos/process/stream", {
        method: "POST",
        body: JSON.stringify({ youtube_url: youtubeUrl }),
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
            if (payload.title) setProcessingTitle(payload.title);
          } else if (payload.type === "progress" && payload.status) {
            setJobPhase(payload.status as JobStatus);
            if (payload.total_chunks) {
              setProgress({
                processed: payload.processed_chunks || 0,
                total: payload.total_chunks,
              });
            }
          } else if (payload.type === "complete" && payload.chatId) {
            setJobPhase("completed");
            if (payload.title) setProcessingTitle(payload.title);
            setTimeout(() => router.push(`/chat/${payload.chatId}`), 600);
            return;
          } else if (payload.type === "error") {
            setError(payload.error || "Processing failed");
            setJobPhase("failed");
            return;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setJobPhase("failed");
    }
  };

  const handleProcessStart = useCallback(
    (type: SourceType, input: string) => {
      if (type === "video") {
        processVideo(input);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiFetch, router],
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const progressLabel =
    progress.total > 0 ? `${progress.processed} / ${progress.total} chunks` : undefined;

  return (
    <AppShell>
      {view === "landing" && (
        <LandingPage
          onProcessStart={handleProcessStart}
          isDark={isDark}
          onThemeToggle={toggleTheme}
          error={error}
        />
      )}

      {view === "processing" && (
        <ProcessingScreen
          type={processingType}
          title={processingTitle}
          currentStep={jobPhaseToStep(jobPhase)}
          steps={VIDEO_STEPS}
          isComplete={jobPhase === "completed"}
          error={jobPhase === "failed" ? error : null}
          progressLabel={progressLabel}
          onRetry={() => {
            setView("landing");
            setError(null);
            setJobPhase("idle");
          }}
        />
      )}
    </AppShell>
  );
}
