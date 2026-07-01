"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ExternalLink,
  Loader2,
  Play,
  X,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/docuvision/AppShell";
import { ThemeToggle } from "@/components/docuvision/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import type { EvalComments, EvalResultRow, EvalScores, EvalSummary } from "@/lib/eval/types";
import { cn } from "@/lib/utils";

type EvalRunResponse = {
  id: string;
  createdAt: string;
  videoId: string;
  limit: number;
  experimentName: string;
  experimentId: string;
  compareUrl: string;
  summary: EvalSummary | null;
  results: EvalResultRow[];
};

type EvalRunHistoryItem = {
  id: string;
  youtubeId: string;
  limit: number;
  experimentName: string;
  experimentId: string;
  compareUrl: string;
  summary: EvalSummary | null;
  createdAt: string;
};

type MetricKey = keyof EvalScores;

const METRICS: { key: MetricKey; label: string; short: string }[] = [
  { key: "groundedness", label: "Faithfulness", short: "Faithfulness" },
  { key: "helpfulness", label: "Answer Relevancy", short: "Answer R." },
  { key: "retrievalRelevance", label: "Context Precision", short: "Context P." },
  { key: "contextRecall", label: "Context Recall", short: "Recall" },
  { key: "correctness", label: "Answer Correctness", short: "Answer C." },
];

type ScoreTone = "good" | "mid" | "poor";

function scoreTone(score: number): ScoreTone {
  if (score >= 0.8) return "good";
  if (score >= 0.5) return "mid";
  return "poor";
}

function formatScore(score: number) {
  return score.toFixed(2);
}

function toneDotClass(tone: ScoreTone, isDark: boolean) {
  if (tone === "good") return isDark ? "bg-emerald-400" : "bg-emerald-500";
  if (tone === "mid") return isDark ? "bg-amber-400" : "bg-amber-500";
  return isDark ? "bg-rose-400" : "bg-rose-500";
}

function tonePillClass(tone: ScoreTone, isDark: boolean) {
  if (tone === "good") {
    return isDark
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (tone === "mid") {
    return isDark
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : "bg-amber-50 text-amber-800 border-amber-200";
  }
  return isDark
    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
    : "bg-rose-50 text-rose-800 border-rose-200";
}

function goldenId(index: number) {
  return `g${String(index + 1).padStart(3, "0")}`;
}

function ScoreCell({
  score,
  isDark,
}: {
  score: number;
  isDark: boolean;
}) {
  const tone = scoreTone(score);
  return (
    <div className="flex items-center justify-end gap-2 tabular-nums">
      <span className={cn("text-sm font-medium", isDark ? "text-slate-200" : "text-slate-800")}>
        {formatScore(score)}
      </span>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", toneDotClass(tone, isDark))} />
    </div>
  );
}

function ScorePill({
  label,
  score,
  isDark,
  active,
  onClick,
}: {
  label: string;
  score: number;
  isDark: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const tone = scoreTone(score);
  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
        tonePillClass(tone, isDark),
        active && (isDark ? "ring-1 ring-white/30" : "ring-1 ring-slate-400"),
        onClick && (isDark ? "hover:brightness-110" : "hover:brightness-95"),
      )}
    >
      <span>{label}</span>
      <span>{formatScore(score)}</span>
    </Tag>
  );
}

function SummaryMetric({
  label,
  value,
  isDark,
}: {
  label: string;
  value: number | null;
  isDark: boolean;
}) {
  const tone = value === null ? "mid" : scoreTone(value);

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isDark ? "bg-slate-900/60 border-white/10" : "bg-white border-slate-200",
      )}
    >
      <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className={cn("text-2xl font-semibold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
          {value === null ? "—" : formatScore(value)}
        </p>
        {value !== null && (
          <span className={cn("h-2.5 w-2.5 rounded-full", toneDotClass(tone, isDark))} />
        )}
      </div>
    </div>
  );
}

function commentForMetric(comments: EvalComments, key: MetricKey): string | undefined {
  return comments[key];
}

function EvalDetailPanel({
  row,
  index,
  isDark,
  activeMetric,
  onMetricChange,
  onClose,
}: {
  row: EvalResultRow;
  index: number;
  isDark: boolean;
  activeMetric: MetricKey | null;
  onMetricChange: (key: MetricKey | null) => void;
  onClose: () => void;
}) {
  const activeComment = activeMetric ? commentForMetric(row.comments, activeMetric) : null;

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden",
        isDark ? "bg-slate-900/80 border-white/10" : "bg-white border-slate-200",
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-4 border-b px-5 py-4",
          isDark ? "border-white/10" : "border-slate-200",
        )}
      >
        <div className="min-w-0 space-y-2">
          <p className={cn("text-xs font-medium uppercase tracking-wide", isDark ? "text-slate-500" : "text-slate-400")}>
            {goldenId(index)}
          </p>
          <p className={cn("text-base font-medium leading-snug", isDark ? "text-white" : "text-slate-900")}>
            {row.question}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {METRICS.map(({ key, short }) => (
              <ScorePill
                key={key}
                label={short}
                score={row.scores[key]}
                isDark={isDark}
                active={activeMetric === key}
                onClick={() => onMetricChange(activeMetric === key ? null : key)}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "shrink-0 rounded-md p-1.5 transition-colors",
            isDark ? "text-slate-400 hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
          )}
          aria-label="Close detail"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <div
          className={cn(
            "space-y-4 border-b p-5 lg:border-b-0 lg:border-r",
            isDark ? "border-white/10" : "border-slate-200",
          )}
        >
          <div>
            <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", isDark ? "text-slate-400" : "text-slate-500")}>
              RAG Response
            </p>
            <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", isDark ? "text-slate-200" : "text-slate-800")}>
              {row.prediction.answer || "—"}
            </p>
          </div>
          <div>
            <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", isDark ? "text-slate-400" : "text-slate-500")}>
              Reference
            </p>
            <div
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm leading-relaxed",
                isDark
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
                  : "border-amber-200 bg-amber-50 text-amber-950",
              )}
            >
              {row.referenceAnswer}
            </div>
          </div>
        </div>

        <div className="p-5">
          <p className={cn("mb-3 text-xs font-semibold uppercase tracking-wide", isDark ? "text-slate-400" : "text-slate-500")}>
            Retrieved Context
          </p>
          {row.prediction.retrievedDocuments.length === 0 ? (
            <p className={cn("text-sm", isDark ? "text-slate-500" : "text-slate-400")}>
              No chunks retrieved.
            </p>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {row.prediction.retrievedDocuments.map((chunk, chunkIndex) => (
                <div
                  key={chunkIndex}
                  className={cn(
                    "rounded-lg border p-3",
                    isDark ? "border-white/10 bg-slate-950/40" : "border-slate-200 bg-slate-50",
                  )}
                >
                  <p className={cn("mb-1.5 text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                    Chunk {chunkIndex + 1}
                  </p>
                  <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-700")}>
                    {chunk}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(activeComment ||
        row.comments.correctness ||
        row.comments.helpfulness ||
        row.comments.groundedness ||
        row.comments.retrievalRelevance ||
        row.comments.contextRecall) && (
        <div
          className={cn(
            "border-t px-5 py-4",
            isDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-slate-50/80",
          )}
        >
          <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", isDark ? "text-slate-400" : "text-slate-500")}>
            {activeMetric
              ? `${METRICS.find((m) => m.key === activeMetric)?.label ?? "Judge"} reasoning`
              : "Judge reasoning"}
          </p>
          {activeComment ? (
            <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-700")}>
              {activeComment}
            </p>
          ) : (
            <div className="space-y-3">
              {METRICS.map(({ key, label }) => {
                const comment = commentForMetric(row.comments, key);
                if (!comment) return null;
                return (
                  <div key={key}>
                    <p className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                      {label}
                    </p>
                    <p className={cn("mt-0.5 text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-700")}>
                      {comment}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvalHistoryTable({
  runs,
  isDark,
  body,
}: {
  runs: EvalRunHistoryItem[];
  isDark: boolean;
  body: string;
}) {
  if (!runs.length) {
    return (
      <p className={cn("text-sm", body)}>
        No past runs yet. Run an evaluation to save results here.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border",
        isDark ? "border-white/10 bg-slate-900/60" : "border-slate-200 bg-white",
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr
              className={cn(
                "border-b text-xs uppercase tracking-wide",
                isDark ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-500",
              )}
            >
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Video</th>
              <th className="px-4 py-3 font-medium text-right">Examples</th>
              <th className="px-4 py-3 font-medium text-right">Correctness</th>
              <th className="px-4 py-3 font-medium text-right">Faithfulness</th>
              <th className="px-4 py-3 font-medium">Experiment</th>
              <th className="px-4 py-3 font-medium text-right">LangSmith</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                className={cn(
                  "border-b last:border-b-0",
                  isDark ? "border-white/5" : "border-slate-100",
                )}
              >
                <td className={cn("px-4 py-3 whitespace-nowrap", isDark ? "text-slate-300" : "text-slate-700")}>
                  {new Date(run.createdAt).toLocaleString()}
                </td>
                <td className={cn("px-4 py-3 font-mono text-xs", isDark ? "text-slate-300" : "text-slate-700")}>
                  {run.youtubeId}
                </td>
                <td className={cn("px-4 py-3 text-right tabular-nums", isDark ? "text-slate-300" : "text-slate-700")}>
                  {run.limit}
                </td>
                <td className="px-4 py-3">
                  <ScoreCell score={run.summary?.avgCorrectness ?? 0} isDark={isDark} />
                </td>
                <td className="px-4 py-3">
                  <ScoreCell score={run.summary?.avgGroundedness ?? 0} isDark={isDark} />
                </td>
                <td className={cn("px-4 py-3 max-w-[200px] truncate text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  {run.experimentName}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={run.compareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700",
                    )}
                  >
                    Compare
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EvalsPage() {
  const { user, apiFetch, isLoading: authLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const router = useRouter();

  const [videoInput, setVideoInput] = useState("");
  const [limit, setLimit] = useState(3);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvalRunResponse | null>(null);
  const [history, setHistory] = useState<EvalRunHistoryItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);

  const loadHistory = useCallback(async () => {
    const params = videoInput.trim()
      ? `?videoId=${encodeURIComponent(videoInput.trim())}`
      : "";
    const res = await apiFetch(`/api/eval/runs${params}`);
    if (!res.ok) return;
    const data = (await res.json()) as { runs: EvalRunHistoryItem[] };
    setHistory(data.runs);
  }, [apiFetch, videoInput]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    loadHistory().catch(() => setHistory([]));
  }, [user, loadHistory]);

  const runEval = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setSelectedIndex(null);
    setActiveMetric(null);

    try {
      const res = await apiFetch("/api/eval/run", {
        method: "POST",
        body: JSON.stringify({ videoId: videoInput, limit }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Evaluation failed");
      }

      const payload = data as EvalRunResponse;
      setResult(payload);
      if (payload.results.length > 0) {
        setSelectedIndex(0);
      }
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setRunning(false);
    }
  }, [apiFetch, videoInput, limit, loadHistory]);

  if (authLoading || !user) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </AppShell>
    );
  }

  const heading = isDark ? "text-white" : "text-slate-900";
  const body = isDark ? "text-slate-400" : "text-slate-600";
  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
    isDark
      ? "bg-slate-900/80 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-400",
  );

  const selectedRow = selectedIndex !== null ? result?.results[selectedIndex] : null;

  return (
    <AppShell>
      <div className={cn("min-h-full", isDark && "dark")}>
        <header
          className={cn(
            "border-b backdrop-blur-md",
            isDark ? "bg-slate-900/80 border-white/10" : "bg-white/80 border-slate-200",
          )}
        >
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <span className={cn("text-lg font-bold", heading)}>DocuVision</span>
              </Link>
              <span className={cn("text-slate-500", isDark && "text-slate-600")}>/</span>
              <span className={cn("font-medium", heading)}>Evals</span>
            </div>
            <ThemeToggle
              className={isDark ? "text-slate-400 hover:text-white" : undefined}
              isDark={isDark}
              onToggle={toggleTheme}
            />
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className={cn("h-6 w-6", isDark ? "text-blue-400" : "text-blue-600")} />
              <h1 className={cn("text-2xl font-bold", heading)}>RAG Evaluation</h1>
            </div>
            <p className={body}>
              Run OpenEvals judges via LangSmith using the golden dataset attached to
              the selected video.
            </p>
          </div>

          <section
            className={cn(
              "space-y-4 rounded-2xl border p-6",
              isDark ? "bg-slate-900/60 border-white/10" : "bg-white border-slate-200",
            )}
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div className="space-y-1.5">
                <label htmlFor="video-input" className={cn("text-sm font-medium", heading)}>
                  YouTube URL or video ID
                </label>
                <input
                  id="video-input"
                  type="text"
                  value={videoInput}
                  onChange={(e) => setVideoInput(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className={inputClass}
                  disabled={running}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="limit" className={cn("text-sm font-medium", heading)}>
                  Examples
                </label>
                <input
                  id="limit"
                  type="number"
                  min={1}
                  max={15}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className={inputClass}
                  disabled={running}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={runEval}
              disabled={running || !videoInput.trim()}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                "bg-blue-600 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running eval…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run evaluation
                </>
              )}
            </button>

            {error && <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p>}
          </section>

          <section className="space-y-4">
            <h2 className={cn("text-lg font-semibold", heading)}>Past runs</h2>
            <p className={cn("text-sm", body)}>
              Saved eval results for comparison. Filtered by video ID when one is entered above.
            </p>
            <EvalHistoryTable runs={history} isDark={isDark} body={body} />
          </section>

          {result?.summary && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className={cn("text-lg font-semibold", heading)}>
                    Experiment — {result.videoId}
                  </h2>
                  <p className={cn("text-sm", body)}>
                    {result.experimentName}
                  </p>
                </div>
                <a
                  href={result.compareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
                    isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700",
                  )}
                >
                  Open in LangSmith
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <SummaryMetric label="Faithfulness" value={result.summary.avgGroundedness} isDark={isDark} />
                <SummaryMetric label="Answer Relevancy" value={result.summary.avgHelpfulness} isDark={isDark} />
                <SummaryMetric label="Context Precision" value={result.summary.avgRetrievalRelevance} isDark={isDark} />
                <SummaryMetric label="Context Recall" value={result.summary.avgContextRecall} isDark={isDark} />
                <SummaryMetric label="Answer Correctness" value={result.summary.avgCorrectness} isDark={isDark} />
              </div>

              <div className="space-y-4">
                <h3 className={cn("text-sm font-semibold uppercase tracking-wide", isDark ? "text-slate-400" : "text-slate-500")}>
                  Per-Golden Scores
                </h3>

                <div
                  className={cn(
                    "overflow-hidden rounded-xl border",
                    isDark ? "border-white/10 bg-slate-900/60" : "border-slate-200 bg-white",
                  )}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead>
                        <tr
                          className={cn(
                            "border-b text-xs uppercase tracking-wide",
                            isDark ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-500",
                          )}
                        >
                          <th className="px-4 py-3 font-medium w-16">#</th>
                          <th className="px-4 py-3 font-medium">Question</th>
                          {METRICS.map(({ key, label }) => (
                            <th key={key} className="px-4 py-3 font-medium text-right whitespace-nowrap">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.results.map((row, index) => {
                          const selected = selectedIndex === index;
                          return (
                            <tr
                              key={`${row.question}-${index}`}
                              onClick={() => {
                                setSelectedIndex(index);
                                setActiveMetric(null);
                              }}
                              className={cn(
                                "cursor-pointer border-b transition-colors last:border-b-0",
                                isDark ? "border-white/5 hover:bg-white/5" : "border-slate-100 hover:bg-slate-50",
                                selected &&
                                  (isDark
                                    ? "bg-blue-500/10 hover:bg-blue-500/10"
                                    : "bg-blue-50 hover:bg-blue-50"),
                              )}
                            >
                              <td className={cn("px-4 py-3 font-mono text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                                {goldenId(index)}
                              </td>
                              <td className={cn("px-4 py-3 max-w-md", isDark ? "text-slate-200" : "text-slate-800")}>
                                <span className="line-clamp-2">{row.question}</span>
                              </td>
                              {METRICS.map(({ key }) => (
                                <td key={key} className="px-4 py-3">
                                  <ScoreCell score={row.scores[key]} isDark={isDark} />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedRow && selectedIndex !== null && (
                  <EvalDetailPanel
                    row={selectedRow}
                    index={selectedIndex}
                    isDark={isDark}
                    activeMetric={activeMetric}
                    onMetricChange={setActiveMetric}
                    onClose={() => setSelectedIndex(null)}
                  />
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </AppShell>
  );
}
