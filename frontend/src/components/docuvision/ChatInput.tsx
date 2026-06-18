"use client";

import React, { useState } from "react";
import { Send, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (msg: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSendMessage, disabled, placeholder }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full">
      <div className="max-w-full mx-auto px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className={cn(
            "relative flex items-end gap-2 bg-white/80 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm border focus-within:ring-2 focus-within:ring-violet-500/50 transition-all pl-2 pr-2 py-2",
            disabled
              ? "border-slate-200 dark:border-white/10 opacity-70"
              : "border-slate-300 dark:border-white/10",
          )}
        >
          <div className="flex pb-1 pl-1 gap-1">
            <button
              type="button"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              placeholder ??
              (disabled ? "Processing source..." : "Ask anything about the document...")
            }
            className="flex-1 max-h-48 min-h-[44px] py-3 px-2 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none disabled:cursor-not-allowed text-[15px]"
            rows={1}
            style={{ overflowY: message.split("\n").length > 1 ? "auto" : "hidden" }}
          />

          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className={cn(
              "p-3 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 h-10 w-10 mb-1 mr-1",
              message.trim() && !disabled
                ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-violet-600/30 hover:scale-105 active:scale-95"
                : "bg-slate-100 dark:bg-white/10 text-slate-400",
            )}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
        <p className="text-center text-[10px] uppercase tracking-widest text-slate-500 mt-2 hidden md:block font-semibold">
          Powered by InsightFlow-X v4.2 &bull; High Accuracy Mode Active
        </p>
      </div>
    </div>
  );
}
