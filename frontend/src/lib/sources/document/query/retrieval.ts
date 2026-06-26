import type { RetrieveContextResult } from "../types";
import {
  RETRIEVAL_CANDIDATE_LIMIT,
  RETRIEVAL_CHUNK_LIMIT,
} from "@/lib/core/rag/constants";
import { getQdrantClient } from "@/lib/core/rag/clients/qdrant";
import { rerankByRelevance } from "@/lib/core/rag/reranker";
import {
  collectionExistsForDocument,
  collectionNameForDocument,
} from "../collection";

type QdrantPayload = {
  text?: string;
  context_text?: string;
  chunk_index?: number;
  page_number?: number;
};

type ScoredPoint = {
  id: string | number;
  score?: number | null;
  payload?: QdrantPayload | null;
};

function documentTextForRerank(point: ScoredPoint): string {
  return point.payload?.text?.trim() || point.payload?.context_text?.trim() || "";
}

function pointsToContext(points: ScoredPoint[]): RetrieveContextResult {
  const parts = points
    .map((point) => point.payload?.context_text?.trim() || point.payload?.text?.trim())
    .filter((text): text is string => Boolean(text));

  return {
    context: parts.length ? parts.join("\n\n") : null,
    chunkCount: parts.length,
  };
}

export async function getAllChunks(documentId: string): Promise<string[]> {
  if (!(await collectionExistsForDocument(documentId))) {
    return [];
  }

  const client = getQdrantClient();
  const collectionName = collectionNameForDocument(documentId);

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
  documentId: string,
  searchQuery: string,
  queryVector: number[],
  limit = RETRIEVAL_CHUNK_LIMIT,
  candidateLimit = RETRIEVAL_CANDIDATE_LIMIT,
): Promise<RetrieveContextResult> {
  if (!(await collectionExistsForDocument(documentId))) {
    return { context: null, chunkCount: 0 };
  }

  const client = getQdrantClient();
  const collectionName = collectionNameForDocument(documentId);

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
      console.error("[document/query/retrieval] reranker failed, using vector order", error);
      usedReranker = false;
      reranked = candidates.slice(0, limit).map((point) => ({
        point,
        vectorScore: point.score ?? 0,
        rerankScore: point.score ?? 0,
      }));
    }

    console.log("[document/query/retrieval] retrieved chunks", {
      documentId,
      searchQuery,
      usedReranker,
      chunkCount: reranked.length,
    });

    return pointsToContext(reranked.map((entry) => entry.point));
  } catch (error) {
    console.error("[document/query/retrieval] Qdrant search error", { collectionName, error });
    return { context: null, chunkCount: 0 };
  }
}
