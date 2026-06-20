import type { RetrieveContextResult } from "../types";
import { collectionNameForVideo, getQdrantClient } from "../clients/qdrant";
import { embedQuery } from "../ingestion/embedder";

type QdrantPayload = {
  text?: string;
  context_text?: string;
  chunk_index?: number;
};

function logRetrievedChunks(
  videoId: string,
  searchQuery: string,
  points: Array<{ id: string | number; score?: number | null; payload?: QdrantPayload | null }>,
  usedThreshold: boolean,
) {
  console.log("[rag/retrieval] retrieved chunks", {
    videoId,
    searchQuery,
    usedThreshold,
    chunks: points.map((point) => ({
      id: point.id,
      score: point.score ?? null,
      chunk_index: point.payload?.chunk_index ?? null,
    })),
  });
}

export async function getAllChunks(videoId: string): Promise<string[]> {
  const client = getQdrantClient();
  const collectionName = collectionNameForVideo(videoId);

  const exists = await client.collectionExists(collectionName);
  if (!exists.exists) {
    return [];
  }

  const ordered: Array<{ id: number | string; text: string }> = [];
  let offset: string | number | Record<string, unknown> | undefined;

  while (true) {
    const page = await client.scroll(collectionName, {
      limit: 100,
      offset,
      with_payload: true,
      with_vector: false,
    });

    for (const record of page.points) {
      const text = (record.payload as QdrantPayload | undefined)?.text?.trim() ?? "";
      if (text) ordered.push({ id: record.id, text });
    }

    if (!page.next_page_offset) break;
    offset = page.next_page_offset;
  }

  ordered.sort((a, b) => {
    const left = typeof a.id === "number" ? a.id : Number(a.id);
    const right = typeof b.id === "number" ? b.id : Number(b.id);
    return left - right;
  });

  return ordered.map((item) => item.text);
}

export async function retrieveContext(
  videoId: string,
  searchQuery: string,
  limit = 8,
  threshold = 0.35,
): Promise<RetrieveContextResult> {
  const client = getQdrantClient();
  const collectionName = collectionNameForVideo(videoId);
  const queryVector = await embedQuery(searchQuery);

  const exists = await client.collectionExists(collectionName);
  if (!exists.exists) {
    return { context: null, chunkCount: 0 };
  }

  try {
    let results = await client.query(collectionName, {
      query: queryVector,
      limit,
      score_threshold: threshold,
      with_payload: true,
    });

    let points = results.points ?? [];
    let usedThreshold = true;

    if (!points.length) {
      usedThreshold = false;
      results = await client.query(collectionName, {
        query: queryVector,
        limit,
        with_payload: true,
      });
      points = results.points ?? [];
    }

    logRetrievedChunks(videoId, searchQuery, points, usedThreshold);

    const parts = points
      .map((point) => (point.payload as QdrantPayload | undefined)?.context_text?.trim())
      .filter((text): text is string => Boolean(text));


    return {
      context: parts.length ? parts.join("\n\n") : null,
      chunkCount: parts.length,
    };
  } catch (error) {
    console.error("[rag/retrieval] Qdrant search error", { collectionName, error });
    return { context: null, chunkCount: 0 };
  }
}
