import type { RetrieveContextResult } from "../types";
import { collectionNameForVideo, getQdrantClient } from "../clients/qdrant";
import { embedQuery } from "../ingestion/embedder";

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
      const text = (record.payload as { text?: string } | undefined)?.text ?? "";
      if (text) {
        ordered.push({ id: record.id, text });
      }
    }

    if (!page.next_page_offset) {
      break;
    }
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
  limit = 5,
  threshold = 0.35,
): Promise<RetrieveContextResult> {
  const client = getQdrantClient();
  const collectionName = collectionNameForVideo(videoId);
  const queryVector = await embedQuery(searchQuery);

  console.info("[rag/retrieval] starting search", {
    videoId,
    collectionName,
    searchQuery,
    limit,
    threshold,
    queryVectorDimensions: queryVector.length,
  });

  const exists = await client.collectionExists(collectionName);
  if (!exists.exists) {
    console.warn("[rag/retrieval] collection does not exist", { collectionName });
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

    if (!points.length) {
      console.warn("[rag/retrieval] no chunks above threshold, retrying without filter", {
        collectionName,
        threshold,
      });

      results = await client.query(collectionName, {
        query: queryVector,
        limit,
        with_payload: true,
      });
      points = results.points ?? [];
    }

    const scores = points.map((point) => point.score ?? 0);
    const texts = points
      .map((point) => (point.payload as { text?: string } | undefined)?.text ?? "")
      .filter(Boolean);

    const context = texts.length ? texts.join("\n\n") : null;

    console.info("[rag/retrieval] completed", {
      collectionName,
      retrievedChunkCount: texts.length,
      contextCharacterLength: context?.length ?? 0,
      topScores: scores.slice(0, 5),
      hasContext: Boolean(context),
    });

    if (!context) {
      console.warn("[rag/retrieval] empty context after search", {
        collectionName,
        rawPointCount: points.length,
      });
    }

    return {
      context,
      chunkCount: texts.length,
    };
  } catch (error) {
    console.error("[rag/retrieval] Qdrant search error", {
      collectionName,
      error,
    });
    return { context: null, chunkCount: 0 };
  }
}
