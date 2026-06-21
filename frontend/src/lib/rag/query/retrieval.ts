import type { RetrieveContextResult } from "../types";
import {
  collectionExistsForVideo,
  collectionNameForVideo,
  getQdrantClient,
} from "../clients/qdrant";
import { embedQuery } from "../ingestion/embedder";

const FALLBACK_CHUNK_LIMIT = 3;

type QdrantPayload = {
  text?: string;
  context_text?: string;
  chunk_index?: number;
};

type ScoredPoint = {
  id: string | number;
  score?: number | null;
  payload?: QdrantPayload | null;
};

function logRetrievedChunks(
  videoId: string,
  searchQuery: string,
  points: ScoredPoint[],
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

function pointsToContext(points: ScoredPoint[]): RetrieveContextResult {
  const parts = points
    .map((point) => point.payload?.context_text?.trim())
    .filter((text): text is string => Boolean(text));

  return {
    context: parts.length ? parts.join("\n\n") : null,
    chunkCount: parts.length,
  };
}

function filterPointsByThreshold(
  points: ScoredPoint[],
  limit: number,
  threshold: number,
): { points: ScoredPoint[]; usedThreshold: boolean } {
  const aboveThreshold = points.filter((point) => (point.score ?? 0) >= threshold);

  if (aboveThreshold.length) {
    return { points: aboveThreshold.slice(0, limit), usedThreshold: true };
  }

  return {
    points: points.slice(0, Math.min(FALLBACK_CHUNK_LIMIT, limit)),
    usedThreshold: false,
  };
}

export async function getAllChunks(videoId: string): Promise<string[]> {
  if (!(await collectionExistsForVideo(videoId))) {
    return [];
  }

  const client = getQdrantClient();
  const collectionName = collectionNameForVideo(videoId);

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

export async function retrieveContextWithVector(
  videoId: string,
  searchQuery: string,
  queryVector: number[],
  limit = 8,
  threshold = 0.35,
): Promise<RetrieveContextResult> {
  if (!(await collectionExistsForVideo(videoId))) {
    return { context: null, chunkCount: 0 };
  }

  const client = getQdrantClient();
  const collectionName = collectionNameForVideo(videoId);

  try {
    const results = await client.query(collectionName, {
      query: queryVector,
      limit,
      with_payload: true,
    });

    const rawPoints = (results.points ?? []) as ScoredPoint[];
    const { points, usedThreshold } = filterPointsByThreshold(rawPoints, limit, threshold);

    logRetrievedChunks(videoId, searchQuery, points, usedThreshold);

    return pointsToContext(points);
  } catch (error) {
    console.error("[rag/retrieval] Qdrant search error", { collectionName, error });
    return { context: null, chunkCount: 0 };
  }
}

export async function retrieveContext(
  videoId: string,
  searchQuery: string,
  limit = 8,
  threshold = 0.35,
): Promise<RetrieveContextResult> {
  const [queryVector, exists] = await Promise.all([
    embedQuery(searchQuery),
    collectionExistsForVideo(videoId),
  ]);

  if (!exists) {
    return { context: null, chunkCount: 0 };
  }

  return retrieveContextWithVector(videoId, searchQuery, queryVector, limit, threshold);
}
