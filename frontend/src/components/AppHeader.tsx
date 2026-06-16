"use client";

import { LogOut, ExternalLink, BadgeCheck as Youtube } from "lucide-react";
import { useRouter } from "next/navigation";

type AppHeaderProps = {
  notionConnected: boolean;
  onLogout: () => void;
};

export function AppHeader({ notionConnected, onLogout }: AppHeaderProps) {
  const router = useRouter();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-neutral-950/50 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-3 hover:opacity-80 transition"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center">
            <Youtube className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">YT-Chat AI</span>
        </button>

        <div className="flex items-center gap-4">
          {notionConnected ? (
            <span className="text-xs text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full">
              Notion Synced
            </span>
          ) : (
            <button
              onClick={() => router.push("/notion-connect")}
              className="text-xs px-3 py-1 rounded-full border border-white/10 hover:bg-white/5 flex items-center gap-2"
            >
              Connect Notion <ExternalLink className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
