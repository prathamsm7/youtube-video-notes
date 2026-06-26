import type { DocumentIngestStreamEvent } from "../types";
import { partitionPdf } from "../partition";
import type { SummarizedChunk } from "./summarize";
import { storeSummarizedChunksStream } from "./store";
import { summarizeDocumentChunksStream } from "./summarize";

export async function* streamDocumentIngest(
  documentId: string,
  fileName: string,
  fileData: Uint8Array,
): AsyncGenerator<DocumentIngestStreamEvent> {
  try {
    yield {
      type: "progress",
      status: "extracting",
      total_chunks: 0,
      processed_chunks: 0,
    };

    const chunks = await partitionPdf(fileName, fileData);
    const totalChunks = chunks.length;

    if (totalChunks === 0) {
      yield {
        type: "error",
        document_id: documentId,
        status: "failed",
        error: "No content could be extracted from this PDF.",
        completed: true,
      };
      return;
    }

    yield {
      type: "progress",
      status: "chunking",
      total_chunks: totalChunks,
      processed_chunks: 0,
    };

    const summarized: SummarizedChunk[] = [];
    for await (const { processed, chunk } of summarizeDocumentChunksStream(chunks)) {
      summarized.push(chunk);
      yield {
        type: "progress",
        status: "embedding",
        total_chunks: totalChunks,
        processed_chunks: processed,
      };
    }

    for await (const { processed } of storeSummarizedChunksStream(
      documentId,
      summarized,
    )) {
      yield {
        type: "progress",
        status: "processing",
        total_chunks: totalChunks,
        processed_chunks: processed,
      };
    }

    yield {
      type: "complete",
      document_id: documentId,
      status: "completed",
      total_chunks: totalChunks,
      processed_chunks: totalChunks,
      completed: true,
    };
  } catch (error) {
    console.error("[document/ingest] pipeline failed:", error);
    const message =
      error instanceof Error ? error.message : "Document processing failed";
    yield {
      type: "error",
      document_id: documentId,
      status: "failed",
      error: message,
      completed: true,
    };
  }
}
