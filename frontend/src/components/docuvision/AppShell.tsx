"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";

export function AppShell({
  children,
  fixedViewport = false,
}: {
  children: ReactNode;
  fixedViewport?: boolean;
}) {
  const { isDark } = useTheme();

  return (
    <div
      className={cn(
        "flex flex-col bg-[#030712] text-slate-100 font-sans relative w-full",
        fixedViewport ? "h-dvh max-h-dvh overflow-hidden" : "min-h-screen",
        isDark ? "dark" : "",
      )}
    >
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vh] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vh] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div
        className={cn(
          "relative z-10 flex flex-col w-full min-h-0",
          fixedViewport ? "flex-1 h-full overflow-hidden" : "min-h-screen",
        )}
      >
        {children}
      </div>
    </div>
  );
}
