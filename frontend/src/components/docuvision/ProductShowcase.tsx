"use client";

import React from "react";
import {
  Bell,
  Copy,
  Maximize,
  Pause,
  Pencil,
  Play,
  Search,
  Settings,
  StickyNote,
  Volume2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TRANSCRIPT = [
  {
    time: "08:00",
    text: (
      <>
        The core challenge in AI ethics isn&apos;t just about writing better code—it&apos;s about{" "}
        <span className="rounded px-1 bg-blue-500/25 text-blue-200 ring-1 ring-blue-400/30">
          building systems that reflect our values
        </span>{" "}
        at scale.
      </>
    ),
  },
  {
    time: "08:05",
    text: (
      <>
        When we deploy models into production, we need{" "}
        <span className="rounded px-1 bg-blue-500/25 text-blue-200 ring-1 ring-blue-400/30">
          continuous monitoring for bias
        </span>{" "}
        and drift, not just one-time audits.
      </>
    ),
  },
  {
    time: "08:12",
    text: (
      <>
        Regulation is catching up, but{" "}
        <span className="rounded px-1 bg-blue-500/25 text-blue-200 ring-1 ring-blue-400/30">
          responsible AI
        </span>{" "}
        has to be a proactive choice by every team building these tools.
      </>
    ),
  },
  {
    time: "08:18",
    text: "Transparency with users—explaining what the model can and can't do—is just as important as the technical safeguards.",
  },
];

const NAV_ITEMS = ["Dashboard", "Library", "Analytics", "Settings"] as const;
const ANALYSIS_TABS = ["Summary", "Transcript", "Insights", "Q&A"] as const;

export function ProductShowcase({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="rounded-2xl border border-slate-700/80 bg-[#0b1120] shadow-2xl shadow-black/40 overflow-hidden">
        {/* App chrome */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 sm:px-5 py-3">
          <div className="flex items-center gap-5 sm:gap-8 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white text-sm hidden sm:inline">DocuVision</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <span
                  key={item}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md",
                    item === "Dashboard"
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-slate-400",
                  )}
                >
                  {item}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs text-slate-500">Search videos...</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                AK
              </div>
              <span className="text-xs text-slate-300 hidden lg:inline">Aisha Khan</span>
            </div>
          </div>
        </div>

        {/* Main workspace */}
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.75fr)] gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Video player */}
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Video Player</h3>
              <div className="flex items-center gap-1.5 text-slate-500">
                <Settings className="w-3.5 h-3.5" />
                <Bell className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(59,130,246,0.15),transparent_60%)]" />
              <div className="absolute left-3 top-3 flex gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/50 text-white border border-white/10">
                  4K
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/50 text-white border border-white/10">
                  16:9
                </span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                </div>
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-8 pb-2">
                <div className="h-1 rounded-full bg-slate-600 mb-2">
                  <div className="h-full w-[26%] rounded-full bg-blue-500" />
                </div>
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <Pause className="w-3.5 h-3.5" />
                    <Volume2 className="w-3.5 h-3.5" />
                    <span className="text-[10px] text-slate-300">08:15 / 32:47</span>
                  </div>
                  <Maximize className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-xs sm:text-sm font-medium text-white leading-snug">
                AI Ethics in Practice — Interview with Sarah Chen (Ep. 4)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["#AI", "#Ethics", "#Tech"].map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Transcript panel */}
          <div className="p-4 sm:p-5 flex flex-col min-h-[280px] lg:min-h-[360px]">
            <h3 className="text-sm font-semibold text-white mb-3">Intelligent Video Analysis</h3>

            <div className="flex items-center gap-1 mb-3 overflow-x-auto">
              {ANALYSIS_TABS.map((tab) => (
                <span
                  key={tab}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0",
                    tab === "Transcript"
                      ? "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                      : "text-slate-500",
                  )}
                >
                  {tab}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 mb-3">
              {[Pencil, Copy, StickyNote].map((Icon, i) => (
                <button
                  key={i}
                  type="button"
                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                  aria-label={["Edit", "Copy", "Add note"][i]}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1 max-h-[220px] lg:max-h-none">
              {TRANSCRIPT.map((entry) => (
                <div key={entry.time} className="flex gap-3">
                  <span className="text-[10px] font-mono text-blue-400/80 pt-0.5 shrink-0 w-9">
                    {entry.time}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <span className="font-medium text-slate-200">Sarah: </span>
                    {entry.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Insights sidebar */}
          <div className="p-4 sm:p-5 space-y-4 bg-slate-900/40">
            <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
              <h4 className="text-xs font-semibold text-white mb-3">AI Summary</h4>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                Key Themes
              </p>
              <ul className="space-y-1.5 mb-3">
                {["Ethical AI", "Bias Mitigation", "Regulation"].map((theme) => (
                  <li key={theme} className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                    {theme}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Summary
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sarah discusses the importance of proactive ethical frameworks, continuous bias
                monitoring, and transparent user communication in production AI systems.
              </p>
            </div>

            <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
              <h4 className="text-xs font-semibold text-white mb-3">AI Insights</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Sentiment</span>
                  <span className="text-xs font-medium text-emerald-400">Positive</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Confidence</span>
                  <span className="text-xs font-medium text-white">94%</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-2">Keywords</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["Ethics", "Responsibility", "Future"].map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/15 text-violet-300 border border-violet-500/20"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
