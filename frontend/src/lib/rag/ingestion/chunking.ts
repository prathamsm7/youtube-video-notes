import type { TranscriptSegment } from "../types";
import { STEP_SECONDS, WINDOW_SECONDS } from "../constants";

export function chunkTranscript(transcript: TranscriptSegment[]): { text: string }[] {
  if (!transcript.length) {
    return [];
  }

  let windowStart = transcript[0].start;
  const videoEnd = transcript[transcript.length - 1].end;
  const chunks: { text: string }[] = [];

  while (windowStart < videoEnd) {
    const windowEnd = windowStart + WINDOW_SECONDS;
    const parts = transcript
      .filter((entry) => entry.start >= windowStart && entry.start < windowEnd)
      .map((entry) => entry.text.trim())
      .filter(Boolean);

    if (parts.length) {
      chunks.push({ text: parts.join(" ") });
    }

    windowStart += STEP_SECONDS;
  }

  return chunks;
}
