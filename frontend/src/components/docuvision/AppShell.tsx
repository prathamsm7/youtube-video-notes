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

  if (fixedViewport) {
    return (
      <div
        className={cn(
          "flex h-dvh max-h-dvh flex-col overflow-hidden font-sans relative w-full transition-colors duration-300",
          isDark ? "dark" : "",
        )}
      >
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
          <div
            className={cn(
              "absolute top-[-10%] left-[-10%] w-[40vw] h-[40vh] rounded-full blur-[100px]",
              isDark ? "bg-blue-600/15" : "bg-blue-400/10",
            )}
          />
          <div
            className={cn(
              "absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vh] rounded-full blur-[100px]",
              isDark ? "bg-violet-600/15" : "bg-violet-400/10",
            )}
          />
        </div>
        <div className="relative z-10 flex flex-1 flex-col min-h-0 w-full overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "font-sans relative w-full transition-colors duration-300",
        isDark ? "dark" : "",
      )}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
        <div
          className={cn(
            "absolute top-[-10%] left-[-10%] w-[40vw] h-[40vh] rounded-full blur-[100px]",
            isDark ? "bg-blue-600/15" : "bg-blue-400/10",
          )}
        />
        <div
          className={cn(
            "absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vh] rounded-full blur-[100px]",
            isDark ? "bg-violet-600/15" : "bg-violet-400/10",
          )}
        />
      </div>
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
