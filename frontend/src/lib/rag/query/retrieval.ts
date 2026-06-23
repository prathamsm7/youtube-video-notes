import type { RetrieveContextResult } from "../types";
import {
  RETRIEVAL_CANDIDATE_LIMIT,
  RETRIEVAL_CHUNK_LIMIT,
} from "../constants";
import {
  collectionExistsForVideo,
  collectionNameForVideo,
  getQdrantClient,
} from "../clients/qdrant";
import { rerankByRelevance } from "./reranker";

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

function documentTextForRerank(point: ScoredPoint): string {
  return point.payload?.text?.trim() || point.payload?.context_text?.trim() || "";
}

function logRetrievedChunks(
  videoId: string,
  searchQuery: string,
  vectorCandidates: ScoredPoint[],
  reranked: Array<{ point: ScoredPoint; vectorScore: number; rerankScore: number }>,
  usedReranker: boolean,
) {
  console.log("[rag/retrieval] retrieved chunks", {
    videoId,
    searchQuery,
    usedReranker,
    vectorCandidates: vectorCandidates.map((point) => ({
      id: point.id,
      vectorScore: point.score ?? null,
      chunk_index: point.payload?.chunk_index ?? null,
    })),
    rerankedChunks: reranked.map((entry) => ({
      id: entry.point.id,
      vectorScore: entry.vectorScore,
      rerankScore: entry.rerankScore,
      chunk_index: entry.point.payload?.chunk_index ?? null,
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
  limit = RETRIEVAL_CHUNK_LIMIT,
  candidateLimit = RETRIEVAL_CANDIDATE_LIMIT,
): Promise<RetrieveContextResult> {
  if (!(await collectionExistsForVideo(videoId))) {
    return { context: null, chunkCount: 0 };
  }

  const client = getQdrantClient();
  const collectionName = collectionNameForVideo(videoId);

  try {
    const results = await client.query(collectionName, {
      query: queryVector,
      limit: candidateLimit,
      with_payload: true,
    });

    const candidates = (results.points ?? []) as ScoredPoint[];
    if (!candidates.length) {
      return { context: null, chunkCount: 0 };
    }

    let reranked: Array<{ point: ScoredPoint; vectorScore: number; rerankScore: number }>;
    let usedReranker = true;

    try {
      const rerankResults = await rerankByRelevance(
        searchQuery,
        candidates,
        documentTextForRerank,
        limit,
      );

      reranked = rerankResults.map((result) => ({
        point: result.item,
        vectorScore: result.item.score ?? 0,
        rerankScore: result.rerankScore,
      }));
    } catch (error) {
      console.error("[rag/retrieval] reranker failed, using vector order", error);
      usedReranker = false;
      reranked = candidates.slice(0, limit).map((point) => ({
        point,
        vectorScore: point.score ?? 0,
        rerankScore: point.score ?? 0,
      }));
    }

    logRetrievedChunks(videoId, searchQuery, candidates, reranked, usedReranker);

    return pointsToContext(reranked.map((entry) => entry.point));
  } catch (error) {
    console.error("[rag/retrieval] Qdrant search error", { collectionName, error });
    return { context: null, chunkCount: 0 };
  }
}


