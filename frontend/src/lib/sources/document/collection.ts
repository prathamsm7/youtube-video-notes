import { getQdrantClient } from "@/lib/core/rag/clients/qdrant";

export function collectionNameForDocument(documentId: string): string {
  return `doc_${documentId.replace(/-/g, "_")}`;
}

const knownCollections = new Set<string>();

export function markCollectionReady(documentId: string): void {
  knownCollections.add(collectionNameForDocument(documentId));
}

export async function collectionExistsForDocument(documentId: string): Promise<boolean> {
  const collectionName = collectionNameForDocument(documentId);
  if (knownCollections.has(collectionName)) {
    return true;
  }

  const exists = await getQdrantClient().collectionExists(collectionName);
  if (exists.exists) {
    knownCollections.add(collectionName);
  }
  return exists.exists;
}
