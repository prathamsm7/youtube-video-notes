"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { CITATION_RANGE_RE, parseTimestamp } from "@/lib/rag/timestamp";

const inlineMarkdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <span className="inline">{children}</span>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
};

const citationClassName =
  "text-[8px] text-blue-400 hover:text-blue-300 hover:underline font-normal inline align-baseline ml-0.5 p-0 m-0 leading-[inherit] border-0 bg-transparent cursor-pointer not-prose";

export function ContentWithCitations({
  content,
  onSeek,
}: {
  content: string;
  onSeek?: (seconds: number) => void;
}) {
  const normalized = content.replace(/\n+\s*(?=\(\s*\d{1,2}:\d{2})/g, " ");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(CITATION_RANGE_RE.source, "g");
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      const segment = normalized.slice(lastIndex, match.index);
      parts.push(
        <ReactMarkdown key={`md-${key++}`} components={inlineMarkdownComponents}>
          {segment}
        </ReactMarkdown>,
      );
    }

    const startLabel = match[1];
    const endLabel = match[2];
    const startSeconds = parseTimestamp(startLabel);

    parts.push(
      onSeek ? (
        <button
          key={`cite-${key++}`}
          type="button"
          onClick={() => onSeek(startSeconds)}
          className={citationClassName}
          title={`Jump to ${startLabel}`}
        >
          ({startLabel} - {endLabel})
        </button>
      ) : (
        <span key={`cite-${key++}`} className={`${citationClassName} cursor-default`}>
          ({startLabel} - {endLabel})
        </span>
      ),
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < normalized.length) {
    parts.push(
      <ReactMarkdown key={`md-${key++}`} components={inlineMarkdownComponents}>
        {normalized.slice(lastIndex)}
      </ReactMarkdown>,
    );
  }

  if (parts.length === 0) {
    return (
      <div className="[&_p]:inline [&_p]:m-0 [&_p]:leading-[inherit]">
        <ReactMarkdown components={inlineMarkdownComponents}>{normalized}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="[&_p]:inline [&_p]:m-0 [&_p]:leading-[inherit] [&_ul]:my-1 [&_li]:my-0">
      {parts}
    </div>
  );
}
