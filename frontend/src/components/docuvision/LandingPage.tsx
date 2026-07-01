"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
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
  Quote,
} from "lucide-react";
import { SourceType } from "@/types/ui";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

interface LandingPageProps {
  onProcessStart: (type: SourceType, input: string | File) => void;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectPdfFile = (file: File | null | undefined) => {
    if (!file) return;

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setPdfNotice("Please upload a PDF file.");
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      setPdfNotice("PDF must be 50MB or smaller.");
      setSelectedFile(null);
      return;
    }

    setPdfNotice(null);
    setSelectedFile(file);
  };

  const handleStart = () => {
    if (activeTab === "video" && videoUrl) {
      onProcessStart("video", videoUrl);
    } else if (activeTab === "pdf" && selectedFile) {
      onProcessStart("pdf", selectedFile);
    } else if (activeTab === "pdf") {
      setPdfNotice("Select a PDF file to continue.");
    }
  };

  const glass = isDark
    ? "bg-slate-900/90 border-white/10 shadow-lg shadow-black/30"
    : "bg-white/80 border-slate-200 backdrop-blur-md";
  const glassMuted = isDark ? "bg-slate-950 border-white/10" : "bg-slate-50";
  const glassActive = isDark ? "bg-slate-800 border-white/10" : "bg-blue-50";
  const heading = isDark ? "text-white" : "text-slate-900";
  const body = isDark ? "text-slate-400" : "text-slate-600";
  const bodyStrong = isDark ? "text-slate-300" : "text-slate-700";
  const border = isDark ? "border-white/10" : "border-slate-200";
  const tabActive = isDark
    ? "text-violet-400 border-violet-500 bg-slate-800"
    : "text-blue-600 border-blue-500 bg-blue-50";
  const tabIdle = isDark
    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
    : "text-slate-500 hover:text-slate-700";

  return (
    <div className={cn("min-h-full w-full max-w-full overflow-x-hidden transition-colors duration-300", isDark && "dark")}>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b",
          isDark ? "bg-slate-900/80 border-white/10" : "bg-white/80 border-slate-200",
        )}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className={cn("font-bold text-lg tracking-tight", heading)}>DocuVision</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle
              className={isDark ? "text-slate-400 hover:text-white" : undefined}
              isDark={isDark}
              onToggle={onThemeToggle}
            />
            <Link
              href="/evals"
              className={cn(
                "text-sm font-medium transition-colors hidden sm:block",
                isDark
                  ? "text-slate-300 hover:text-white"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Evals
            </Link>
            <button
              type="button"
              onClick={() =>
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
              }
              className={cn(
                "text-sm font-medium transition-colors hidden sm:block",
                isDark
                  ? "text-slate-300 hover:text-white"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              How it works
            </button>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-16 px-4 overflow-x-hidden">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1
              className={cn(
                "text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight break-words",
                heading,
              )}
            >
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
            <p className={cn("mt-4 text-lg sm:text-xl max-w-2xl mx-auto", body)}>
              Upload PDFs or paste video links. We index everything—text, tables, images, and
              transcripts—so you can find answers instantly.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={cn(
              "mt-12 max-w-2xl mx-auto rounded-2xl shadow-xl overflow-hidden relative border",
              glass,
            )}
          >
            <div className={cn("flex border-b", border)}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("video");
                  setPdfNotice(null);
                  setSelectedFile(null);
                }}
                className={cn(
                  "flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2",
                  activeTab === "video" ? tabActive : cn("border-transparent", tabIdle),
                )}
              >
                <Video className="w-4 h-4" />
                Video URL
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("pdf");
                  setPdfNotice(null);
                }}
                className={cn(
                  "flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2",
                  activeTab === "pdf" ? tabActive : cn("border-transparent", tabIdle),
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && videoUrl) handleStart();
                        }}
                        className={cn(
                          "w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all placeholder-slate-400",
                          glassMuted,
                          border,
                          heading,
                        )}
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        selectPdfFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsHoveringDrop(true);
                      }}
                      onDragLeave={() => setIsHoveringDrop(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsHoveringDrop(false);
                        selectPdfFile(e.dataTransfer.files?.[0]);
                      }}
                      className={cn(
                        "border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer",
                        isHoveringDrop
                          ? "border-violet-500 " + (isDark ? "bg-slate-800" : "bg-violet-50")
                          : isDark
                            ? "border-white/20 hover:border-violet-500 hover:bg-slate-800/60"
                            : "border-slate-300 hover:border-violet-400",
                      )}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud
                        className={cn(
                          "w-10 h-10 mx-auto mb-4 transition-colors",
                          isHoveringDrop ? "text-violet-500" : "text-slate-400",
                        )}
                      />
                      <p className={cn("font-medium", heading)}>
                        {selectedFile ? selectedFile.name : "Click to upload or drag and drop"}
                      </p>
                      <p className={cn("text-sm mt-1", body)}>
                        {selectedFile
                          ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                          : "PDF up to 50MB"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleStart}
                      disabled={!selectedFile}
                      className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 ml-auto"
                    >
                      Process & Index
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {(error || pdfNotice) && (
                <p className="mt-4 text-sm text-red-400 text-left">{error || pdfNotice}</p>
              )}
            </div>
          </motion.div>
        </div>

        <div className={cn("mt-20 max-w-4xl mx-auto text-center border-t pt-10", border)}>
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-6">
            Trusted by innovative teams
          </p>
          <div className="flex flex-wrap justify-center gap-8 sm:gap-16 items-center opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
            {["Acme Corp", "Globex", "Soylent", "Initech", "Umbrella"].map((company) => (
              <div
                key={company}
                className={cn(
                  "text-xl font-black tracking-tighter",
                  isDark ? "text-slate-300" : "text-slate-800",
                )}
              >
                {company}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 max-w-6xl mx-auto" id="how-it-works">
          <div className="text-center mb-12">
            <h2 className={cn("text-2xl font-bold", heading)}>How it works</h2>
            <p className={cn("mt-2", body)}>
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
                className={cn("p-6 rounded-2xl shadow-xl border", glass)}
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4 border",
                    glassActive,
                    border,
                  )}
                >
                  {feature.icon}
                </div>
                <h3 className={cn("text-lg font-semibold mb-2", heading)}>{feature.title}</h3>
                <p className={cn("text-sm leading-relaxed", body)}>{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-24 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className={cn("text-2xl font-bold", heading)}>Loved by researchers</h2>
            <p className={cn("mt-2", body)}>
              See how DocuVision is changing the way people work.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                text: "DocuVision saves me hours of reading every week. The video transcription and semantic search is incredibly accurate.",
                author: "Sarah Jenkins",
                role: "Product Manager",
              },
              {
                text: "We dumped our old PDF indexing tool. The user experience here, combined with high-accuracy retrieval, makes all the difference.",
                author: "Marcus Thorne",
                role: "Data Scientist",
              },
              {
                text: "I threw a 2-hour board meeting video at it, and it instantly answered my questions about Q3 financials with exact timestamp sources.",
                author: "Elena Rossi",
                role: "Financial Analyst",
              },
            ].map((testimonial, i) => (
              <motion.div
                key={testimonial.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={cn(
                  "p-6 rounded-2xl shadow-xl flex flex-col justify-between border",
                  glass,
                )}
              >
                <div>
                  <Quote className="w-8 h-8 text-violet-500/30 mb-4" />
                  <p className={cn("text-sm italic mb-6", bodyStrong)}>
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-violet-600/20 rounded-full flex items-center justify-center border border-white/10">
                    <span
                      className={cn(
                        "text-sm font-bold",
                        isDark ? "text-slate-200" : "text-slate-900",
                      )}
                    >
                      {testimonial.author.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h4 className={cn("text-sm font-semibold", heading)}>{testimonial.author}</h4>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-24 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className={cn(
              "relative rounded-3xl p-8 sm:p-12 text-center overflow-hidden border",
              isDark
                ? "bg-gradient-to-br from-slate-900 to-slate-900/80 border-violet-500/30"
                : "bg-gradient-to-br from-blue-600/10 to-violet-600/10 border-blue-500/20 backdrop-blur-md",
            )}
          >
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-violet-500/20 rounded-full blur-[80px]" />

            <div className="relative z-10">
              <h2 className={cn("text-3xl font-bold mb-4", heading)}>
                Ready to unlock your documents?
              </h2>
              <p className={cn("mb-8 max-w-xl mx-auto", isDark ? "text-slate-300" : body)}>
                Stop reading long documents and scrubbing through videos. Get straight to the
                insights you need.
              </p>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={cn(
                  "px-8 py-4 font-semibold rounded-xl transition-colors shadow-xl",
                  isDark
                    ? "bg-white text-slate-900 hover:bg-slate-100"
                    : "bg-slate-900 text-white hover:bg-slate-800",
                )}
              >
                Start Chatting Now
              </button>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className={cn("py-8 text-center text-sm border-t mt-12", border, body)}>
        <p>&copy; {new Date().getFullYear()} DocuVision AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
