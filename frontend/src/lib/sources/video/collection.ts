import { getQdrantClient } from "@/lib/core/rag/clients/qdrant";

export function collectionNameForVideo(videoId: string): string {
  return `video_${videoId.replace(/-/g, "_")}`;
}

const knownCollections = new Set<string>();

export function markCollectionReady(videoId: string): void {
  knownCollections.add(collectionNameForVideo(videoId));
}

export async function collectionExistsForVideo(videoId: string): Promise<boolean> {
  const collectionName = collectionNameForVideo(videoId);
  if (knownCollections.has(collectionName)) {
    return true;
  }

  const exists = await getQdrantClient().collectionExists(collectionName);
  if (exists.exists) {
    knownCollections.add(collectionName);
  }
  return exists.exists;
}
