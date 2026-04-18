"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
  Zap,
  Link2,
  FileText,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// --- Notion SVG Icon ---
function NotionIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

const NOTION_CLIENT_ID = "33fd872b-594c-8154-9698-00376ede0b37";
const REDIRECT_URI = encodeURIComponent("http://localhost:3000/notion-connect");
const AUTH_URL = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code`;

type Status = "idle" | "connecting" | "success" | "error";

const features = [
  {
    icon: <FileText className="w-5 h-5" />,
    title: "Auto-save Notes",
    desc: "Save YouTube insights directly to your Notion workspace.",
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: "Instant Sync",
    desc: "Your transcription activity reflected in Notion in real time.",
  },
  {
    icon: <Link2 className="w-5 h-5" />,
    title: "Structured Pages",
    desc: "Generate clean, formatted Notion pages from video summaries.",
  },
];

function NotionConnectPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const initialStatus: Status = error ? "error" : code ? "connecting" : "idle";
  const initialError = error ? "You denied access to Notion. You can try again anytime." : null;

  const [status, setStatus] = useState<Status>(initialStatus);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);

  const { user: authUser, apiFetch } = useAuth();

  useEffect(() => {
    if (!code || error || !authUser) return;

    let cancelled = false;

    const exchangeAndSync = async () => {
      try {
        const res = await apiFetch("/api/notion/auth", {
          method: "POST",
          body: JSON.stringify({ code }),
        });

        const data = await res.json();
        if (cancelled) return;

        if (data.success) {
          setStatus("success");
          setWorkspaceName(data.workspace_name ?? "your workspace");
        } else {
          setStatus("error");
          setErrorMessage(data.error ?? "Failed to connect Notion. Please try again.");
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage("A network error occurred. Please try again.");
      }
    };

    exchangeAndSync();
    return () => { cancelled = true; };
  }, [code, error, authUser, apiFetch]);

  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => router.push("/"), 3500);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-80px] left-[-80px] w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-80px] right-[-80px] w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-10 items-center relative z-10">
        <div className="hidden lg:flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-3xl font-bold bg-indigo-400 bg-clip-text text-transparent">YouTube AI</span>
          </div>
          <div className="space-y-3">
            <h1 className="text-5xl font-bold leading-tight">Connect Notion</h1>
            <p className="text-gray-400 text-lg leading-relaxed">Save your insights directly to your workspace.</p>
          </div>
          <div className="space-y-4">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="w-10 h-10 shrink-0 bg-indigo-500/15 border border-indigo-500/25 rounded-xl flex items-center justify-center text-indigo-400">{f.icon}</div>
                <div>
                  <p className="font-semibold text-white">{f.title}</p>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            {status === "idle" && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 bg-white/5 border border-white/15 rounded-2xl flex items-center justify-center">
                    <NotionIcon className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">Connect your Notion</h2>
                </div>
                <a href={AUTH_URL} className="flex items-center justify-center gap-3 w-full py-4 bg-indigo-600 rounded-2xl font-semibold text-lg hover:bg-indigo-500 transition-all">
                  <NotionIcon className="w-6 h-6" />
                  Connect Notion
                  <ArrowRight className="w-5 h-5" />
                </a> home
              </div>
            )}

            {status === "connecting" && (
              <div className="flex flex-col items-center gap-6 py-8">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                <h2 className="text-xl font-semibold">Connecting to Notion...</h2>
              </div>
            )}

            {status === "success" && (
              <div className="flex flex-col items-center gap-6 py-8">
                <CheckCircle className="w-16 h-16 text-emerald-400" />
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Connected! 🎉</h2>
                  <p className="text-gray-400">Linked to {workspaceName}. Redirecting...</p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-6 py-8">
                <AlertCircle className="w-16 h-16 text-red-400" />
                <h2 className="text-xl font-bold">Connection failed</h2>
                <p className="text-gray-400 text-center">{errorMessage}</p>
                <a href={AUTH_URL} className="py-3 px-8 bg-indigo-600 rounded-xl font-semibold hover:bg-indigo-500 transition-all">Try again</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotionConnectPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center p-4"><Loader2 className="w-12 h-12 text-indigo-400 animate-spin" /></div>}>
      <NotionConnectPageContent />
    </React.Suspense>
  );
}
