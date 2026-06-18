"use client";

import React from "react";
import { motion } from "framer-motion";
import { Loader2, FileText, Video, CheckCircle2 } from "lucide-react";
import { SourceType } from "@/types/ui";

interface ProcessingScreenProps {
  type: SourceType;
  title: string;
  currentStep: number;
  steps: string[];
  isComplete?: boolean;
  error?: string | null;
  progressLabel?: string;
  onRetry?: () => void;
}

export function ProcessingScreen({
  type,
  title,
  currentStep,
  steps,
  isComplete = false,
  error,
  progressLabel,
  onRetry,
}: ProcessingScreenProps) {
  const step = isComplete ? steps.length - 1 : currentStep;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-transparent transition-colors z-10 relative min-h-screen">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white/80 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 p-8 text-center space-y-6"
      >
        <div className="relative w-20 h-20 mx-auto">
          {error ? (
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-2xl font-bold">
              !
            </div>
          ) : step < steps.length - 1 ? (
            <Loader2 className="w-20 h-20 text-violet-500 animate-spin" />
          ) : (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <CheckCircle2 className="w-20 h-20 text-blue-500" />
            </motion.div>
          )}

          <div className="absolute inset-0 flex items-center justify-center">
            {type === "video" ? (
              <Video className="w-8 h-8 text-slate-400 dark:text-slate-300" />
            ) : (
              <FileText className="w-8 h-8 text-slate-400 dark:text-slate-300" />
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {error ? "Processing Failed" : "Processing Source"}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm truncate font-medium">
            {title}
          </p>
          {progressLabel && !error && (
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-2">{progressLabel}</p>
          )}
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          {error && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
            >
              Try again
            </button>
          )}
        </div>

        {!error && (
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/10 text-left">
            {steps.map((text, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: i <= step ? 1 : 0.3, x: 0 }}
                className="flex items-center gap-3 text-sm"
              >
                {i < step ? (
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                ) : i === step ? (
                  <Loader2 className="w-4 h-4 text-violet-500 animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-white/10 shrink-0" />
                )}
                <span
                  className={
                    i <= step
                      ? "text-slate-900 dark:text-slate-200"
                      : "text-slate-400 dark:text-slate-600"
                  }
                >
                  {text}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
