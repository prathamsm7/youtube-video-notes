"use client";

import React, { useMemo } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import type { Components } from "react-markdown";
import { CITATION_RANGE_RE, parseTimestamp } from "@/lib/rag/timestamp";

const citationClassName =
  "citation-timestamp text-blue-400 hover:text-blue-300 hover:underline font-normal inline whitespace-nowrap align-baseline ml-1 p-0 m-0 border-0 bg-transparent cursor-pointer";

function injectCitationLinks(content: string): string {
  const normalized = content.replace(/\n+\s*(?=\(\s*\d{1,2}:\d{2})/g, " ");
  const re = new RegExp(CITATION_RANGE_RE.source, "g");
  return normalized.replace(re, (_match, start: string, end: string) => {
    const startSeconds = parseTimestamp(start);
    return `[(${start} - ${end})](cite:${startSeconds})`;
  });
}

function citationUrlTransform(url: string): string {
  if (url.startsWith("cite:")) {
    return url;
  }
  return defaultUrlTransform(url);
}

export function ContentWithCitations({
  content,
  onSeek,
}: {
  content: string;
  onSeek?: (seconds: number) => void;
}) {
  const markdown = useMemo(() => injectCitationLinks(content), [content]);

  const components = useMemo<Components>(
    () => ({
      p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="my-2 pl-5 list-disc space-y-1">{children}</ul>,
      ol: ({ children }) => <ol className="my-2 pl-5 list-decimal space-y-1">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      a: ({ href, children }) => {
        if (href?.startsWith("cite:")) {
          const startSeconds = parseInt(href.slice(5), 10);
          const label = String(children);

          if (onSeek) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSeek(startSeconds);
                }}
                className={citationClassName}
                title={`Jump to ${label.replace(/^\(|\)$/g, "").split(" - ")[0]?.trim() ?? label}`}
              >
                {children}
              </button>
            );
          }

          return (
            <span className={`${citationClassName} cursor-default`}>
              {children}
            </span>
          );
        }

        if (!href) {
          return <span className={citationClassName}>{children}</span>;
        }

        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            {children}
          </a>
        );
      },
    }),
    [onSeek],
  );

  return (
    <div className="not-prose text-[15px] [&_p]:leading-relaxed [&_li]:leading-relaxed [&_ul]:leading-relaxed">
      <ReactMarkdown urlTransform={citationUrlTransform} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
