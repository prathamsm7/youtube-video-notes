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
      timeout: 120_000,
      checkCompatibility: false,
    });
  }
  return client;
}
