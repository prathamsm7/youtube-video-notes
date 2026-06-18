"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeft, FileText, Video, Loader2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { VideoPanel } from "./VideoPanel";
import { SourceInfo, ChatMessage } from "@/types/ui";
import { cn } from "@/lib/utils";

interface ConversationPageProps {
  source: SourceInfo;
  sources: SourceInfo[];
  messages: ChatMessage[];
  isThinking: boolean;
  streamingMessageId?: string | null;
  onSendMessage: (content: string) => void;
  onNewChat: () => void;
  onSelectSource: (id: string) => void;
  isDark: boolean;
  onThemeToggle: () => void;
  userEmail?: string;
  onLogout?: () => void;
  inputDisabled?: boolean;
  notionConnected?: boolean;
  onSaveToNotion?: (message: ChatMessage) => void;
  savingToNotionId?: string | null;
  messagesLoading?: boolean;
  chatsLoading?: boolean;
}

export function ConversationPage({
  source,
  sources,
  messages,
  isThinking,
  streamingMessageId,
  onSendMessage,
  onNewChat,
  onSelectSource,
  isDark,
  onThemeToggle,
  userEmail,
  onLogout,
  inputDisabled,
  notionConnected,
  onSaveToNotion,
  savingToNotionId,
  messagesLoading = false,
  chatsLoading = false,
}: ConversationPageProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts =
    source.type === "video"
      ? [
          "Summarize the key points",
          "What is the main conclusion?",
          "Find any mentioned URLs or resources",
        ]
      : [
          "Identify any tables or charts",
          "Summarize the document",
          "What are the main arguments?",
        ];

  const visibleMessages = messages.filter(
    (m) => m.role === "user" || m.content || m.id === streamingMessageId,
  );

  const hasChatContent = visibleMessages.length > 0 || isThinking;

  useEffect(() => {
    window.scrollTo(0, 0);
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking, streamingMessageId]);

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        sources={sources}
        activeSourceId={source.id}
        onSelectSource={onSelectSource}
        onNewChat={onNewChat}
        isOpen={isSidebarOpen}
        isDark={isDark}
        onThemeToggle={onThemeToggle}
        userEmail={userEmail}
        onLogout={onLogout}
        chatsLoading={chatsLoading}
      />

      <div
        className={cn(
          "flex flex-1 flex-col min-h-0 min-w-0 h-full overflow-hidden",
          "xl:transition-[flex] xl:duration-300 xl:ease-in-out",
          isSidebarOpen ? "xl:flex-1" : "xl:flex-[6]",
        )}
      >
        <header className="shrink-0 h-16 px-4 md:px-8 flex items-center bg-white/80 dark:bg-white/5 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3 min-w-0 w-full">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500 transition-colors shrink-0"
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={isSidebarOpen}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeft className="w-5 h-5" />
              )}
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <span className="hidden sm:inline-block shrink-0 px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 uppercase">
                {source.type} Active
              </span>
              <span className="text-sm font-semibold truncate">{source.title}</span>
            </div>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        >
          {messagesLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
          ) : !hasChatContent ? (
            <div className="min-h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-brand-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-brand-100 dark:border-white/10 backdrop-blur-md">
                {source.type === "video" ? (
                  <Video className="w-8 h-8 text-brand-500 dark:text-violet-400" />
                ) : (
                  <FileText className="w-8 h-8 text-brand-500 dark:text-violet-400" />
                )}
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-white">
                Ready to chat
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md">
                I&apos;ve fully indexed &ldquo;{source.title}&rdquo;. Ask me anything about its
                contents, tables, or visual descriptions.
              </p>

              <div className="mt-8 grid gap-3 w-full max-w-lg">
                {suggestedPrompts.map((prompt, i) => (
                  <motion.button
                    key={prompt}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => onSendMessage(prompt)}
                    disabled={inputDisabled}
                    className={cn(
                      "text-left px-5 py-3.5 bg-white/80 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm",
                      inputDisabled && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <p className="text-sm text-slate-700 dark:text-slate-200">{prompt}</p>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <MessageList
              messages={visibleMessages}
              isThinking={isThinking}
              streamingMessageId={streamingMessageId}
              notionConnected={notionConnected}
              onSaveToNotion={onSaveToNotion}
              savingToNotionId={savingToNotionId}
            />
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-white/10 bg-[#030712]">
          <ChatInput
            onSendMessage={onSendMessage}
            disabled={inputDisabled || isThinking || messagesLoading}
            placeholder={
              inputDisabled ? "Video is still processing..." : "Ask anything about the video..."
            }
          />
        </footer>
      </div>

      <VideoPanel title={source.title} sidebarCollapsed={!isSidebarOpen} />
    </div>
  );
}
