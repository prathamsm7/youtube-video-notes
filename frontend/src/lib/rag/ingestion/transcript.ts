import type { TranscriptSegment } from "../types";

type SupadataChunk = {
  text?: string;
  offset?: number;
  duration?: number;
};

export async function getTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    throw new Error("SUPADATA_API_KEY is not configured");
  }

  const url = new URL("https://api.supadata.ai/v1/transcript");
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  url.searchParams.set("lang", "en");
  url.searchParams.set("text", "false");

  const response = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Supadata transcript request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    content?: SupadataChunk[];
  };

  const chunks = data.content ?? [];
  if (!chunks.length) {
    throw new Error("No transcript content returned by Supadata");
  }

  return chunks.map((chunk) => {
    const startMs = chunk.offset ?? 0;
    const durationMs = chunk.duration ?? 0;
    const start = startMs / 1000;
    const duration = durationMs / 1000;
    return {
      text: chunk.text ?? "",
      start,
      end: start + duration,
    };
  });
}
