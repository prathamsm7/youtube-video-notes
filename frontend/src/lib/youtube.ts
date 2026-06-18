export function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  return match ? match[1] : null;
}

export async function fetchYoutubeTitle(youtubeId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`,
      { next: { revalidate: 3600 } },
    );
    if (res.ok) {
      const data = await res.json();
      return data.title || `Video ${youtubeId}`;
    }
  } catch {
    // fall through
  }
  return `Video ${youtubeId}`;
}
