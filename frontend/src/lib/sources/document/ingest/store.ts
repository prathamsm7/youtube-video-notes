import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  QDRANT_UPSERT_BATCH_SIZE,
} from "@/lib/core/rag/constants";
import { getQdrantClient } from "@/lib/core/rag/clients/qdrant";
import { generateEmbeddings } from "@/lib/core/rag/embedding";
import { collectionNameForDocument, markCollectionReady } from "../collection";
import type { SummarizedChunk } from "./summarize";

async function ensureCollection(
  collectionName: string,
  totalChunks: number,
): Promise<void> {
  const qdrant = getQdrantClient();
  const exists = await qdrant.collectionExists(collectionName);

  if (exists.exists) {
    const info = await qdrant.getCollection(collectionName);
    const vectors = info.config?.params?.vectors;
    const currentSize =
      vectors && typeof vectors === "object" && "size" in vectors
        ? vectors.size
        : undefined;

    if (currentSize === EMBEDDING_DIMENSIONS) {
      const scroll = await qdrant.scroll(collectionName, {
        limit: 1,
        with_payload: true,
      });
      const point = scroll.points[0];
      const payload = point?.payload as {
        embedding_model?: string;
        total_chunks?: number;
      } | undefined;

      if (
        payload?.embedding_model === EMBEDDING_MODEL &&
        payload?.total_chunks === totalChunks
      ) {
        return;
      }
    }

    await qdrant.deleteCollection(collectionName);
  }

  await qdrant.createCollection(collectionName, {
    vectors: {
      size: EMBEDDING_DIMENSIONS,
      distance: "Cosine",
    },
  });
}

function buildContextText(pageNumber: number | null, chunkIndex: number, summary: string): string {
  const pageLabel =
    typeof pageNumber === "number" && pageNumber > 0
      ? `p. ${pageNumber}`
      : `chunk ${chunkIndex + 1}`;
  return `[${pageLabel}]\n${summary}`;
}

export async function* storeSummarizedChunksStream(
  documentId: string,
  chunks: SummarizedChunk[],
): AsyncGenerator<{ processed: number; total: number }> {
  const collectionName = collectionNameForDocument(documentId);
  const qdrant = getQdrantClient();
  const totalChunks = chunks.length;

  await ensureCollection(collectionName, totalChunks);

  const batchSize = QDRANT_UPSERT_BATCH_SIZE;
  for (let i = 0; i < totalChunks; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    const texts = batchChunks.map((chunk) => chunk.summary);
    const embeddings = await generateEmbeddings(texts);
    const isLastBatch = i + batchChunks.length >= totalChunks;

    await qdrant.upsert(collectionName, {
      wait: isLastBatch,
      points: embeddings.map((vector, index) => {
        const chunk = batchChunks[index];
        const contextText = buildContextText(
          chunk.pageNumber,
          chunk.chunkIndex,
          chunk.summary,
        );
        return {
          id: i + index,
          vector,
          payload: {
            text: chunk.summary,
            context_text: contextText,
            raw_text: chunk.content.text,
            tables_html: chunk.content.tables,
            images_count: chunk.content.images.length,
            content_types: chunk.content.types,
            page_number: chunk.pageNumber,
            chunk_index: chunk.chunkIndex,
            element_id: chunk.elementId,
            embedding_model: EMBEDDING_MODEL,
            total_chunks: totalChunks,
            original_content: JSON.stringify({
              raw_text: chunk.content.text,
              tables_html: chunk.content.tables,
              images_count: chunk.content.images.length,
            }),
          },
        };
      }),
    });

    const processed = Math.min(i + batchChunks.length, totalChunks);
    yield { processed, total: totalChunks };
  }

  markCollectionReady(documentId);
}

export async function storeSummarizedChunks(
  documentId: string,
  chunks: SummarizedChunk[],
  onProgress?: (processed: number, total: number) => void,
): Promise<void> {
  for await (const { processed, total } of storeSummarizedChunksStream(
    documentId,
    chunks,
  )) {
    onProgress?.(processed, total);
  }
}
