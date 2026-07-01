import { extractYoutubeId } from "@/lib/sources/video/youtube";

const YOUTUBE_ID_RE = /^[0-9A-Za-z_-]{11}$/;

/** Accept a YouTube URL or 11-character video ID. */
export function resolveYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromUrl = extractYoutubeId(trimmed);
  if (fromUrl) return fromUrl;

  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed;

  return null;
}
