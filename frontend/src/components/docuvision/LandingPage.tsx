"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Link as LinkIcon,
  FileText,
  Video,
  ArrowRight,
  Zap,
  Shield,
  Search,
} from "lucide-react";
import { SourceType } from "@/types/ui";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

interface LandingPageProps {
  onProcessStart: (type: SourceType, linkOrFile: string) => void;
  isDark: boolean;
  onThemeToggle: () => void;
  error?: string | null;
}

export function LandingPage({
  onProcessStart,
  isDark,
  onThemeToggle,
  error,
}: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<SourceType>("video");
  const [videoUrl, setVideoUrl] = useState("");
  const [isHoveringDrop, setIsHoveringDrop] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  const handleStart = () => {
    if (activeTab === "video" && videoUrl) {
      onProcessStart("video", videoUrl);
    } else if (activeTab === "pdf") {
      setPdfNotice("PDF upload is coming soon. Use the Video URL tab for now.");
    }
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-white/5 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
              DocuVision
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle
              className="dark:text-slate-400 dark:hover:text-white"
              isDark={isDark}
              onToggle={onThemeToggle}
            />
            <button
              type="button"
              onClick={() =>
                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
              }
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors hidden sm:block"
            >
              How it works
            </button>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              Chat with your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-violet-500">
                documents
              </span>{" "}
              and{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-blue-500">
                videos
              </span>
              .
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Upload PDFs or paste video links. We index everything—text, tables, images, and
              transcripts—so you can find answers instantly.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-12 max-w-2xl mx-auto bg-white/80 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden relative"
          >
            <div className="flex border-b border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("video");
                  setPdfNotice(null);
                }}
                className={cn(
                  "flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                  activeTab === "video"
                    ? "text-blue-600 dark:text-violet-400 border-b-2 border-blue-500 dark:border-violet-500 bg-blue-50 dark:bg-white/10"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:hover:bg-white/5",
                )}
              >
                <Video className="w-4 h-4" />
                Video URL
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("pdf")}
                className={cn(
                  "flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                  activeTab === "pdf"
                    ? "text-blue-600 dark:text-violet-400 border-b-2 border-blue-500 dark:border-violet-500 bg-blue-50 dark:bg-white/10"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:hover:bg-white/5",
                )}
              >
                <FileText className="w-4 h-4" />
                PDF Upload
              </button>
            </div>

            <div className="p-8">
              <AnimatePresence mode="wait">
                {activeTab === "video" && (
                  <motion.div
                    key="video"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-4"
                  >
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="url"
                        placeholder="Paste YouTube or Vimeo URL..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleStart}
                      disabled={!videoUrl}
                      className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 ml-auto"
                    >
                      Process & Index
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {activeTab === "pdf" && (
                  <motion.div
                    key="pdf"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsHoveringDrop(true);
                      }}
                      onDragLeave={() => setIsHoveringDrop(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsHoveringDrop(false);
                        handleStart();
                      }}
                      className={cn(
                        "border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer",
                        isHoveringDrop
                          ? "border-violet-500 bg-violet-50 dark:bg-white/10"
                          : "border-slate-300 dark:border-white/20 hover:border-violet-400 dark:hover:border-violet-500 dark:hover:bg-white/5",
                      )}
                      onClick={handleStart}
                    >
                      <UploadCloud
                        className={cn(
                          "w-10 h-10 mx-auto mb-4 transition-colors",
                          isHoveringDrop ? "text-violet-500" : "text-slate-400",
                        )}
                      />
                      <p className="text-slate-900 dark:text-white font-medium">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        PDF up to 50MB
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {(error || pdfNotice) && (
                <p className="mt-4 text-sm text-red-400 text-left">{error || pdfNotice}</p>
              )}
            </div>
          </motion.div>
        </div>

        <div className="mt-24 max-w-6xl mx-auto" id="how-it-works">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">How it works</h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Go from a 2-hour lecture to actionable answers in seconds.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="w-6 h-6 text-yellow-500" />,
                title: "Fast Indexing",
                desc: "We process documents and transcribe videos at lightning speed.",
              },
              {
                icon: <Search className="w-6 h-6 text-violet-400" />,
                title: "Deep Search",
                desc: "Ask complex questions and we retrieve grounded facts from text, images, and tables.",
              },
              {
                icon: <Shield className="w-6 h-6 text-green-500" />,
                title: "Secure & Private",
                desc: "Your uploaded assets remain private and are only processed for your conversation.",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white/80 dark:bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl"
              >
                <div className="w-12 h-12 bg-slate-50 dark:bg-white/10 rounded-xl flex items-center justify-center mb-4 border border-slate-100 dark:border-white/10">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm border-t border-slate-200 dark:border-white/10 mt-12">
        <p>&copy; {new Date().getFullYear()} DocuVision AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
