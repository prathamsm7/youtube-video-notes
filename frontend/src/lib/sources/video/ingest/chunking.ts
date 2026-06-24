import { STEP_SECONDS, WINDOW_SECONDS } from "../constants";
import { formatTimestampRange } from "../timestamp";
import type { TranscriptSegment, VideoTextChunk } from "../types";

/**
 * Merge transcript segments into overlapping time windows.
 * - `text`: pure joined text for embedding only
 * - `contextText`: same window with per-segment timestamp labels (for LLM / citations)
 */
export function chunkTranscript(transcript: TranscriptSegment[]): VideoTextChunk[] {
  if (!transcript.length) {
    return [];
  }

  let windowStart = transcript[0].start;
  const videoEnd = transcript[transcript.length - 1].end;
  const chunks: VideoTextChunk[] = [];
  let chunkIndex = 0;

  while (windowStart < videoEnd) {
    const windowEnd = windowStart + WINDOW_SECONDS;

    const segments = transcript.filter(
      (entry) => entry.start >= windowStart && entry.start < windowEnd,
    );

    if (segments.length) {
      const text = segments
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join(" ");

      const contextText = segments
        .map((s) => {
          const line = s.text.trim();
          if (!line) return "";
          return `[${formatTimestampRange(s.start, s.end)}] ${line}`;
        })
        .filter(Boolean)
        .join("\n");

      if (text) {
        chunks.push({
          text,
          contextText,
          startSeconds: windowStart,
          endSeconds: Math.min(windowEnd, segments[segments.length - 1].end),
          chunkIndex: chunkIndex++,
        });
      }
    }

    windowStart += STEP_SECONDS;
  }

  return chunks;
}
