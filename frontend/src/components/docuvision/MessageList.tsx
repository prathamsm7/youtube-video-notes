"use client";

import React from "react";
import { motion } from "framer-motion";
import { Bot, Loader2, Bookmark } from "lucide-react";
import { ChatMessage } from "@/types/ui";
import { cn } from "@/lib/utils";
import { useVideoPlayer } from "@/context/VideoPlayerContext";
import { ContentWithCitations } from "./ContentWithCitations";
import { isNotionFeatureEnabled } from "@/lib/features";

interface MessageListProps {
  messages: ChatMessage[];
  isThinking?: boolean;
  streamingMessageId?: string | null;
  notionConnected?: boolean;
  onSaveToNotion?: (message: ChatMessage) => void;
  savingToNotionId?: string | null;
}

export function MessageList({
  messages,
  isThinking,
  streamingMessageId,
  notionConnected,
  onSaveToNotion,
  savingToNotionId,
}: MessageListProps) {
  return (
    <div className="px-4 py-8">
      <div className="w-full max-w-full mx-auto space-y-8">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={message.id === streamingMessageId}
            notionConnected={notionConnected}
            onSaveToNotion={onSaveToNotion}
            savingToNotion={savingToNotionId === message.id}
          />
        ))}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 max-w-full"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col gap-2 pt-1.5">
              <div className="flex items-center gap-2 px-4 py-3 bg-white/80 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl rounded-tl-none shadow-xl w-fit">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mr-2 font-bold">
                  AI is typing
                </div>
                <div
                  className="w-1 h-1 bg-violet-500 rounded-full animate-bounce opacity-50"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-1 h-1 bg-violet-500 rounded-full animate-bounce opacity-70"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-1 h-1 bg-violet-500 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
  notionConnected,
  onSaveToNotion,
  savingToNotion,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
  notionConnected?: boolean;
  onSaveToNotion?: (message: ChatMessage) => void;
  savingToNotion?: boolean;
}) {
  const { seekTo } = useVideoPlayer();
  const isUser = message.role === "user";
  const showStreamStatus = isStreaming && message.streamStatus && !message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-4", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          isUser
            ? "bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/10"
            : "bg-gradient-to-br from-blue-500 to-violet-600",
        )}
      >
        {isUser ? (
          <div className="text-slate-600 dark:text-slate-300 font-semibold text-xs">U</div>
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      <div
        className={cn("flex flex-col gap-2 max-w-[85%]", isUser ? "items-end" : "items-start")}
      >
        <div
          className={cn(
            "px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-xl relative group",
            isUser
              ? "bg-slate-900 text-white dark:bg-blue-600/90 dark:text-white rounded-tr-none"
              : "bg-white/80 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 rounded-tl-none max-w-none",
          )}
        >
          {isUser ? (
            message.content.split("\n").map((line, i, lines) => (
              <React.Fragment key={`${message.id}-line-${i}`}>
                {line}
                {i < lines.length - 1 && <br />}
              </React.Fragment>
            ))
          ) : showStreamStatus ? (
            <p className="text-sm text-slate-400 flex items-center gap-2 m-0 not-prose">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              {message.streamStatus}
            </p>
          ) : (
            <ContentWithCitations content={message.content} onSeek={seekTo} />
          )}

          {isNotionFeatureEnabled() &&
            notionConnected &&
            !isUser &&
            message.content &&
            onSaveToNotion && (
            <button
              type="button"
              onClick={() => onSaveToNotion(message)}
              disabled={savingToNotion}
              className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-opacity"
              title="Save to Notion"
            >
              {savingToNotion ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
