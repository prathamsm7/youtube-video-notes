import { QdrantClient } from "@qdrant/js-client-rest";

let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) {
    throw new Error("QDRANT_URL and QDRANT_API_KEY must be configured");
  }
  if (!client) {
    client = new QdrantClient({
      url,
      apiKey,
      // Timeout is in milliseconds; 60 would abort after 60ms.
      timeout: 120_000,
      checkCompatibility: false,
    });
  }
  return client;
}

export function collectionNameForVideo(videoId: string): string {
  return `video_${videoId.replace(/-/g, "_")}`;
}
