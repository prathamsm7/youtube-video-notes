"use client";

import React, { createContext, useCallback, useContext, useRef } from "react";

type VideoPlayerContextType = {
  youtubeId: string | null;
  seekTo: (seconds: number) => void;
  registerSeekHandler: (handler: (seconds: number) => void) => () => void;
};

const VideoPlayerContext = createContext<VideoPlayerContextType | null>(null);

export function VideoPlayerProvider({
  youtubeId,
  children,
}: {
  youtubeId: string | null;
  children: React.ReactNode;
}) {
  const seekHandlerRef = useRef<((seconds: number) => void) | null>(null);

  const registerSeekHandler = useCallback((handler: (seconds: number) => void) => {
    seekHandlerRef.current = handler;
    return () => {
      if (seekHandlerRef.current === handler) {
        seekHandlerRef.current = null;
      }
    };
  }, []);

  const seekTo = useCallback((seconds: number) => {
    seekHandlerRef.current?.(seconds);
  }, []);

  return (
    <VideoPlayerContext.Provider value={{ youtubeId, seekTo, registerSeekHandler }}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayer() {
  const ctx = useContext(VideoPlayerContext);
  if (!ctx) {
    throw new Error("useVideoPlayer must be used within VideoPlayerProvider");
  }
  return ctx;
}
