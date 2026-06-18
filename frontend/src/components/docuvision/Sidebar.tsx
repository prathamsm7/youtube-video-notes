"use client";

import React, { useState } from "react";
import { Search, Zap, Plus, LogOut, ChevronDown, ChevronUp } from "lucide-react";
import { SourceInfo } from "@/types/ui";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

interface SidebarProps {
  sources: SourceInfo[];
  activeSourceId: string | null;
  onSelectSource: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  isDark: boolean;
  onThemeToggle: () => void;
  userEmail?: string;
  onLogout?: () => void;
  chatsLoading?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Sidebar({
  sources,
  activeSourceId,
  onSelectSource,
  onNewChat,
  isOpen,
  isDark,
  onThemeToggle,
  userEmail,
  onLogout,
  chatsLoading = false,
}: SidebarProps) {
  const [recentOpen, setRecentOpen] = useState(true);
  const userInitial = userEmail?.charAt(0).toUpperCase() ?? "U";

  return (
    <aside
      className={cn(
        "h-full max-h-full min-h-0 flex flex-col overflow-hidden transition-all duration-300 ease-in-out z-40",
        "bg-slate-50/80 dark:bg-slate-950/40 backdrop-blur-xl border-slate-200 dark:border-white/10",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-[280px] max-md:shadow-2xl max-md:border-r",
        isOpen
          ? "max-md:translate-x-0 md:w-[280px] md:shrink-0 md:border-r"
          : "max-md:-translate-x-full md:w-0 md:shrink-0 md:border-r-0",
      )}
    >
      <div className="shrink-0 w-[280px] p-6 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 cursor-pointer"
          onClick={onNewChat}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            DocuVision
          </span>
        </button>
        <ThemeToggle
          className="dark:text-slate-400 dark:hover:text-white"
          isDark={isDark}
          onToggle={onThemeToggle}
        />
      </div>

      <div className="shrink-0 w-[280px] px-6 mb-4">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-4 font-medium transition-all shadow-sm"
        >
          <Plus className="w-4 h-4 dark:text-violet-400" />
          <span className="text-sm font-medium">New Chat</span>
        </button>
      </div>

      <div className="shrink-0 w-[280px] px-6 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search recent..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 w-[280px] px-6">
        <button
          type="button"
          onClick={() => setRecentOpen((open) => !open)}
          className="shrink-0 flex items-center justify-between w-full text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 py-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <span>Recent Chats ({sources.length})</span>
          {recentOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {recentOpen && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pb-2 -mx-1 px-1">
            {chatsLoading ? (
              <div className="text-sm text-slate-500 py-2">Loading chats...</div>
            ) : sources.length === 0 ? (
              <div className="text-sm text-slate-500 py-2">No indexing history yet.</div>
            ) : (
              sources.map((source) => (
                <div
                  key={source.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "p-3 rounded-lg flex items-center gap-3 transition-colors cursor-pointer",
                    activeSourceId === source.id
                      ? "bg-brand-50 dark:bg-white/10 border border-transparent dark:border-white/10"
                      : "hover:bg-slate-200/50 dark:hover:bg-white/5",
                  )}
                  onClick={() => onSelectSource(source.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelectSource(source.id);
                  }}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0 transition-colors",
                      activeSourceId === source.id
                        ? "bg-blue-500"
                        : "bg-slate-300 dark:bg-slate-600",
                    )}
                  />
                  <div className="flex-1 overflow-hidden">
                    <p
                      className={cn(
                        "text-sm truncate transition-colors",
                        activeSourceId === source.id
                          ? "font-medium text-slate-900 dark:text-slate-100"
                          : "text-slate-600 dark:text-slate-400",
                      )}
                    >
                      {source.title}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase">
                      {source.type} • {formatRelativeTime(source.dateAdded)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 mt-auto w-[280px] p-6 border-t border-slate-200 dark:border-white/5 flex items-center gap-3 text-sm bg-slate-50/80 dark:bg-slate-950/40">
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-white/10 flex items-center justify-center font-semibold text-xs text-slate-600 dark:text-slate-300">
          {userInitial}
        </div>
        <div className="flex-1 overflow-hidden min-w-0">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {userEmail ?? "User Account"}
          </p>
          <p className="text-[10px] text-slate-500">Pro Account</p>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
