"use client";

import React, { useEffect, useId, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useVideoPlayer } from "@/context/VideoPlayerContext";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: { onReady?: (event: { target: YtPlayer }) => void };
        },
      ) => YtPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YtPlayer = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  destroy: () => void;
};

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (window.YT?.Player) resolve();
  });

  return ytApiPromise;
}

export function VideoPanel({
  title,
  sidebarCollapsed = false,
}: {
  title?: string;
  sidebarCollapsed?: boolean;
}) {
  const { youtubeId, registerSeekHandler } = useVideoPlayer();
  const elementId = useId().replace(/:/g, "");
  const playerRef = React.useRef<YtPlayer | null>(null);
  const [ready, setReady] = useState(false);

  const panelClassName = cn(
    "hidden xl:flex flex-col border-l border-slate-200 dark:border-white/10 bg-slate-950/40 min-h-0 min-w-0",
    "transition-[flex] duration-300 ease-in-out",
    sidebarCollapsed ? "flex-[4]" : "flex-1",
  );

  useEffect(() => {
    if (!youtubeId) return;

    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;

      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(elementId, {
        videoId: youtubeId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            if (!cancelled) setReady(true);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      setReady(false);
    };
  }, [youtubeId, elementId]);

  useEffect(() => {
    if (!ready) return;
    return registerSeekHandler((seconds) => {
      playerRef.current?.seekTo(seconds, true);
      playerRef.current?.playVideo();
    });
  }, [ready, registerSeekHandler]);

  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [sidebarCollapsed]);

  if (!youtubeId) {
    return (
      <aside className={panelClassName}>
        <div className="p-4 text-sm text-slate-500">No video loaded</div>
      </aside>
    );
  }

  const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  return (
    <aside className={panelClassName}>
      <div className="p-4 border-b border-slate-200 dark:border-white/10 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-slate-200 line-clamp-2">{title ?? "Video"}</p>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10"
            title="Open on YouTube"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">
          Click timestamps in answers to jump here
        </p>
      </div>
      <div className="p-4 flex-1 min-h-0 flex flex-col">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shrink-0">
          <div id={elementId} className="absolute inset-0 w-full h-full" />
        </div>
      </div>
    </aside>
  );
}
