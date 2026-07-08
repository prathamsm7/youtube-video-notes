import { UnstructuredClient } from "unstructured-client";
import { Strategy } from "unstructured-client/sdk/models/shared";
import { buildDocumentChunks, type DocumentChunk } from "./content";
import { EXCLUDED_PARTITION_ELEMENTS } from "./excluded-elements";

export { EXCLUDED_PARTITION_ELEMENTS };

const client = new UnstructuredClient({
  ...(process.env.UNSTRUCTURED_API_URL
    ? { serverURL: process.env.UNSTRUCTURED_API_URL }
    : {}),
  security: {
    apiKeyAuth: process.env.UNSTRUCTURED_API_KEY ?? "",
  },
});

export async function partitionPdf(
  fileName: string,
  data: Uint8Array,
): Promise<DocumentChunk[]> {
  const partitioned = await client.general.partition({
    partitionParameters: {
      files: {
        content: data,
        fileName,
      },
      strategy: Strategy.HiRes,
      uniqueElementIds: true,
      extractImageBlockTypes: ["Image", "Table", "Figure"],
      splitPdfPage: true,
      splitPdfAllowFailed: true,
      splitPdfConcurrencyLevel: 15,
      pdfInferTableStructure: true,
      chunkingStrategy: "by_title",
      maxCharacters: 1500,
      newAfterNChars: 1000,
      combineUnderNChars: 500,
      includeOrigElements: true,
      
      // Legacy unstructured-client v0.31 does not forward exclude_elements to the API.
      // Header/Footer/PageNumber are stripped locally via EXCLUDED_PARTITION_ELEMENTS.
    },
  });

  const elements = Array.isArray(partitioned) ? partitioned : [];
  return buildDocumentChunks(elements);
}
