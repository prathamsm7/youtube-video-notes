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
  Check,
} from "lucide-react";
import { SourceType } from "@/types/ui";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { isNotionFeatureEnabled } from "@/lib/features";
import { ProductShowcase } from "./ProductShowcase";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

const PRICING_PLANS = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    description: "Try DocuVision on your own documents and videos.",
    features: [
      "5 documents or videos per month",
      "Basic chat with citations",
      "PDF & YouTube support",
      "7-day chat history",
    ],
    cta: "Get started free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "For professionals who need unlimited access.",
    features: [
      "Unlimited documents & videos",
      "Priority indexing",
      "Advanced semantic search",
      "Unlimited chat history",
      "Export to Notion", // hidden when NOTION_FEATURE_ENABLED is false (lib/features.ts)
    ],
    cta: "Start Pro trial",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$49",
    period: "per month",
    description: "Collaborate with your team on shared knowledge.",
    features: [
      "Everything in Pro",
      "Up to 10 team members",
      "Shared workspaces",
      "Admin controls & usage analytics",
      "Priority support",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
] as const;

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" as const },
  transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
};

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
    ? "bg-slate-900/95 border-white/10 shadow-lg shadow-black/20"
    : "bg-white/90 border-slate-200 shadow-lg shadow-slate-200/50";
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

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const sectionHeading = "text-center mb-10 sm:mb-12";
  const sectionWrap = "max-w-6xl mx-auto px-4 sm:px-6";

  return (
    <div className={cn("w-full transition-colors duration-300", isDark && "dark")}>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 border-b",
          isDark ? "bg-slate-900/95 border-white/10" : "bg-white/95 border-slate-200",
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className={cn("font-bold text-lg tracking-tight", heading)}>DocuVision</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
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
              onClick={() => scrollToSection("how-it-works")}
              className={cn(
                "text-sm font-medium transition-colors hidden sm:block",
                isDark
                  ? "text-slate-300 hover:text-white"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("pricing")}
              className={cn(
                "text-sm font-medium transition-colors hidden sm:block",
                isDark
                  ? "text-slate-300 hover:text-white"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Pricing
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section id="hero" className="pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1
                className={cn(
                  "text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] break-words",
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
              <p className={cn("mt-5 sm:mt-6 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed", body)}>
                Upload PDFs or paste video links. We index everything—text, tables, images, and
                transcripts—so you can find answers instantly.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={cn(
                "mt-10 sm:mt-12 max-w-2xl mx-auto rounded-2xl shadow-xl overflow-hidden relative border",
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
        </section>

        {/* Product showcase */}
        <section className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              {...fadeUp}
              className="text-center mb-8 sm:mb-10"
            >
              <h2 className={cn("text-2xl sm:text-3xl font-bold", heading)}>
                See DocuVision in action
              </h2>
              <p className={cn("mt-3 max-w-2xl mx-auto", body)}>
                Watch, read, and analyze — video player, timestamped transcript, and AI insights
                side by side.
              </p>
            </motion.div>
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
              <ProductShowcase />
            </motion.div>
          </div>
        </section>

        {/* Social proof */}
        <section className={cn("py-12 sm:py-16 border-t", border)}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-widest mb-6 sm:mb-8">
              Trusted by innovative teams
            </p>
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 sm:gap-x-16 items-center opacity-60">
              {["Acme Corp", "Globex", "Soylent", "Initech", "Umbrella"].map((company) => (
                <div
                  key={company}
                  className={cn(
                    "text-lg sm:text-xl font-black tracking-tighter",
                    isDark ? "text-slate-300" : "text-slate-800",
                  )}
                >
                  {company}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-16 sm:py-24">
          <div className={sectionWrap}>
            <div className={sectionHeading}>
              <h2 className={cn("text-2xl sm:text-3xl font-bold", heading)}>How it works</h2>
              <p className={cn("mt-3 max-w-xl mx-auto", body)}>
                Go from a 2-hour lecture to actionable answers in seconds.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
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
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: i * 0.08 }}
                  className={cn("p-6 sm:p-7 rounded-2xl border", glass)}
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
        </section>

        {/* Testimonials */}
        <section className="py-16 sm:py-24">
          <div className={sectionWrap}>
            <div className={sectionHeading}>
              <h2 className={cn("text-2xl sm:text-3xl font-bold", heading)}>Loved by researchers</h2>
              <p className={cn("mt-3 max-w-xl mx-auto", body)}>
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
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: i * 0.08 }}
                  className={cn(
                    "p-6 sm:p-7 rounded-2xl flex flex-col justify-between border h-full",
                    glass,
                  )}
                >
                  <div>
                    <Quote className="w-8 h-8 text-violet-500/30 mb-4" />
                    <p className={cn("text-sm italic mb-6 leading-relaxed", bodyStrong)}>
                      &ldquo;{testimonial.text}&rdquo;
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-violet-600/20 rounded-full flex items-center justify-center border border-white/10 shrink-0">
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
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-16 sm:py-24">
          <div className={sectionWrap}>
            <div className={sectionHeading}>
              <h2 className={cn("text-2xl sm:text-3xl font-bold", heading)}>Simple, transparent pricing</h2>
              <p className={cn("mt-3 max-w-xl mx-auto", body)}>
                Start free and upgrade when you need more power.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {PRICING_PLANS.map((plan, i) => (
                <motion.div
                  key={plan.name}
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: i * 0.08 }}
                  className={cn(
                    "relative flex flex-col rounded-2xl border p-6 sm:p-8",
                    plan.highlighted
                      ? isDark
                        ? "bg-gradient-to-b from-violet-600/20 to-slate-900/95 border-violet-500/50 shadow-xl shadow-violet-900/20 ring-1 ring-violet-500/30"
                        : "bg-gradient-to-b from-violet-50 to-white border-violet-300 shadow-xl shadow-violet-200/50 ring-1 ring-violet-200"
                      : glass,
                  )}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white">
                      Most popular
                    </span>
                  )}

                  <div className="mb-6">
                    <h3 className={cn("text-lg font-semibold", heading)}>{plan.name}</h3>
                    <p className={cn("mt-1 text-sm", body)}>{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className={cn("text-4xl font-bold tracking-tight", heading)}>
                        {plan.price}
                      </span>
                      <span className={cn("text-sm", body)}>/{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features
                      .filter(
                        (feature) =>
                          isNotionFeatureEnabled() || feature !== "Export to Notion",
                      )
                      .map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <Check
                          className={cn(
                            "w-4 h-4 mt-0.5 shrink-0",
                            plan.highlighted ? "text-violet-500" : "text-green-500",
                          )}
                        />
                        <span className={bodyStrong}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => scrollToSection("hero")}
                    className={cn(
                      "w-full py-3 px-4 rounded-xl font-medium text-sm transition-colors",
                      plan.highlighted
                        ? "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-lg shadow-violet-600/25"
                        : isDark
                          ? "bg-slate-800 hover:bg-slate-700 text-white border border-white/10"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200",
                    )}
                  >
                    {plan.cta}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <motion.div
              {...fadeUp}
              className={cn(
                "relative rounded-3xl p-8 sm:p-12 text-center overflow-hidden border",
                isDark
                  ? "bg-gradient-to-br from-slate-900 to-slate-800 border-violet-500/30"
                  : "bg-gradient-to-br from-blue-50 to-violet-50 border-blue-200",
              )}
            >
              <div className="relative z-10">
                <h2 className={cn("text-2xl sm:text-3xl font-bold mb-4", heading)}>
                  Ready to unlock your documents?
                </h2>
                <p className={cn("mb-8 max-w-xl mx-auto leading-relaxed", isDark ? "text-slate-300" : body)}>
                  Stop reading long documents and scrubbing through videos. Get straight to the
                  insights you need.
                </p>
                <button
                  type="button"
                  onClick={() => scrollToSection("hero")}
                  className={cn(
                    "px-8 py-4 font-semibold rounded-xl transition-colors shadow-lg",
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
        </section>
      </main>

      <footer className={cn("py-8 text-center text-sm border-t", border, body)}>
        <p>&copy; {new Date().getFullYear()} DocuVision AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
