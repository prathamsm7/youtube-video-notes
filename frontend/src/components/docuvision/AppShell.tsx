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
        "flex flex-1 flex-col font-sans relative w-full overflow-x-hidden transition-colors duration-300",
        fixedViewport ? "h-dvh max-h-dvh overflow-hidden" : "min-h-full",
        isDark ? "dark" : "",
      )}
    >
      <div
        className={cn(
          "absolute top-[-10%] left-[-10%] w-[40vw] h-[40vh] rounded-full blur-[120px] pointer-events-none",
          isDark ? "bg-blue-600/20" : "bg-blue-400/15",
        )}
      />
      <div
        className={cn(
          "absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vh] rounded-full blur-[120px] pointer-events-none",
          isDark ? "bg-violet-600/20" : "bg-violet-400/15",
        )}
      />
      <div
        className={cn(
          "relative z-10 flex flex-col w-full min-h-0",
          fixedViewport ? "flex-1 h-full overflow-hidden" : "min-h-full flex-1",
        )}
      >
        {children}
      </div>
    </div>
  );
}
