import { END, START, StateGraph } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, QDRANT_UPSERT_BATCH_SIZE } from "../constants";
import {
  collectionNameForVideo,
  getQdrantClient,
  markCollectionReady,
} from "../clients/qdrant";
import { chunkTranscript } from "../ingestion/chunking";
import { generateEmbeddings } from "../ingestion/embedder";
import { getTranscript } from "../ingestion/transcript";
import type { IngestStreamEvent, TextChunk } from "../types";
import { formatTimestampRange } from "../timestamp";
import { IngestStateAnnotation, type IngestState } from "./states";

function emit(config: LangGraphRunnableConfig, event: IngestStreamEvent) {
  config.writer?.(event);
}

function progress(
  config: LangGraphRunnableConfig,
  update: {
    status: string;
    total_chunks: number;
    processed_chunks: number;
  },
) {
  emit(config, { type: "progress", ...update });
}

function embedTextForChunk(chunk: TextChunk): string {
  const range = formatTimestampRange(chunk.startSeconds, chunk.endSeconds);
  return `Video transcript segment [${range}]: ${chunk.text}`;
}

async function collectionNeedsFullReembed(
  collectionName: string,
  totalChunks: number,
): Promise<boolean> {
  const qdrant = getQdrantClient();
  const exists = await qdrant.collectionExists(collectionName);
  if (!exists.exists) {
    return true;
  }

  const info = await qdrant.getCollection(collectionName);
  const vectors = info.config?.params?.vectors;
  const currentSize =
    vectors && typeof vectors === "object" && "size" in vectors
      ? vectors.size
      : undefined;

  if (currentSize !== EMBEDDING_DIMENSIONS) {
    return true;
  }

  const scroll = await qdrant.scroll(collectionName, {
    limit: 1,
    with_payload: true,
  });
  const point = scroll.points[0];
  if (!point?.payload) {
    return true;
  }

  const payload = point.payload as {
    embedding_model?: string;
    total_chunks?: number;
  };

  return (
    payload.embedding_model !== EMBEDDING_MODEL ||
    payload.total_chunks !== totalChunks
  );
}

async function extractTranscriptNode(
  state: IngestState,
  config: LangGraphRunnableConfig,
) {
  progress(config, {
    status: "Extracting Transcript",
    total_chunks: 0,
    processed_chunks: 0,
  });

  try {
    const transcript = await getTranscript(state.videoId);
    return {
      status: "Extracting Transcript",
      transcript,
      totalChunks: transcript.length,
      processedChunks: 0,
    };
  } catch (error) {
    console.error("Failed to extract transcript:", error);
    const message =
      error instanceof Error && error.message.toLowerCase().includes("transcript")
        ? "Could not retrieve transcript. The video might not have captions or is restricted."
        : "Failed to process the video. Please ensure it has captions and try again.";

    emit(config, {
      type: "error",
      video_id: state.videoId,
      status: "failed",
      error: message,
      completed: true,
    });

    return {
      status: "failed",
      error: message,
      completed: true,
    };
  }
}

function routeAfterExtract(state: IngestState) {
  if (state.status === "failed") {
    return END;
  }
  return "chunk_transcript";
}

async function chunkTranscriptNode(
  state: IngestState,
  config: LangGraphRunnableConfig,
) {
  progress(config, {
    status: "Chunking Transcript",
    total_chunks: state.totalChunks,
    processed_chunks: 0,
  });

  const chunks = chunkTranscript(state.transcript);
  return {
    status: "Chunking Transcript",
    chunks,
    totalChunks: chunks.length,
    processedChunks: 0,
  };
}

async function embedAndStoreNode(
  state: IngestState,
  config: LangGraphRunnableConfig,
) {
  const chunks = state.chunks;
  const totalChunks = chunks.length;
  const collectionName = collectionNameForVideo(state.videoId);
  const qdrant = getQdrantClient();

  progress(config, {
    status: "Processing Chunks",
    total_chunks: totalChunks,
    processed_chunks: 0,
  });

  try {
    const needsFullReembed = await collectionNeedsFullReembed(collectionName, totalChunks);
    let existingCount = 0;

    if (needsFullReembed) {
      const exists = await qdrant.collectionExists(collectionName);
      if (exists.exists) {
        await qdrant.deleteCollection(collectionName);
      }
      await qdrant.createCollection(collectionName, {
        vectors: {
          size: EMBEDDING_DIMENSIONS,
          distance: "Cosine",
        },
      });
    } else {
      const countResult = await qdrant.count(collectionName, { exact: true });
      existingCount = countResult.count ?? 0;
    }

    if (existingCount >= totalChunks) {
      markCollectionReady(state.videoId);
      progress(config, {
        status: "Completed Chunks Processing",
        total_chunks: totalChunks,
        processed_chunks: existingCount,
      });
      emit(config, {
        type: "complete",
        video_id: state.videoId,
        status: "Completed Chunks Processing",
        total_chunks: totalChunks,
        processed_chunks: existingCount,
        completed: true,
      });
      return {
        status: "Completed Chunks Processing",
        totalChunks,
        processedChunks: existingCount,
        completed: true,
      };
    }

    const batchSize = QDRANT_UPSERT_BATCH_SIZE;
    for (let i = existingCount; i < totalChunks; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);
      const texts = batchChunks.map(embedTextForChunk);
      const embeddings = await generateEmbeddings(texts);
      const isLastBatch = i + batchChunks.length >= totalChunks;

      await qdrant.upsert(collectionName, {
        wait: isLastBatch,
        points: embeddings.map((vector, index) => ({
          id: i + index,
          vector,
          payload: {
            text: batchChunks[index].text,
            context_text: batchChunks[index].contextText,
            start_seconds: batchChunks[index].startSeconds,
            end_seconds: batchChunks[index].endSeconds,
            chunk_index: batchChunks[index].chunkIndex,
            embedding_model: EMBEDDING_MODEL,
            total_chunks: totalChunks,
          },
        })),
      });

      const processed = i + batchChunks.length;
      progress(config, {
        status: "Processing...",
        total_chunks: totalChunks,
        processed_chunks: processed,
      });
    }

    markCollectionReady(state.videoId);

    progress(config, {
      status: "Completed Processing",
      total_chunks: totalChunks,
      processed_chunks: totalChunks,
    });

    emit(config, {
      type: "complete",
      video_id: state.videoId,
      status: "Completed Processing",
      total_chunks: totalChunks,
      processed_chunks: totalChunks,
      completed: true,
    });

    return {
      status: "Completed Processing",
      totalChunks,
      processedChunks: totalChunks,
      completed: true,
    };
  } catch (error) {
    console.error("Failed to embed/store chunks:", error);
    const message =
      error instanceof Error && error.message.toLowerCase().includes("timeout")
        ? "Vector database timed out. Please try again."
        : "An error occurred during embedding processing.";

    emit(config, {
      type: "error",
      video_id: state.videoId,
      status: "Failed Processing",
      total_chunks: totalChunks,
      error: message,
      completed: true,
    });

    return {
      status: "Failed Processing",
      totalChunks,
      error: message,
      completed: true,
    };
  }
}

export function buildIngestGraph() {
  const graph = new StateGraph(IngestStateAnnotation)
    .addNode("extract_transcript", extractTranscriptNode)
    .addNode("chunk_transcript", chunkTranscriptNode)
    .addNode("embed_and_store", embedAndStoreNode)
    .addEdge(START, "extract_transcript")
    .addConditionalEdges("extract_transcript", routeAfterExtract)
    .addEdge("chunk_transcript", "embed_and_store")
    .addEdge("embed_and_store", END);

  return graph.compile();
}
