import { gunzipSync, inflateSync } from "zlib";

type UnstructuredElement = {
  type?: string;
  element_id?: string;
  text?: string;
  metadata?: {
    image_base64?: string;
    image_mime_type?: string;
    text_as_html?: string;
    page_number?: number;
    orig_elements?: UnstructuredElement[] | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ChunkImage = {
  data: string;
  mimeType: string;
};

export type ChunkContentData = {
  text: string;
  tables: string[];
  images: ChunkImage[];
  types: Array<"text" | "table" | "image">;
};

export type DocumentChunk = {
  element_id: string | null;
  page_number: number | null;
  content: ChunkContentData;
};

const IMAGE_TYPES = new Set(["image", "figure", "picture"]);
const DEFAULT_IMAGE_MIME_TYPE = "image/png";

function normalizeImageBase64(raw: string, mimeType?: string): ChunkImage {
  const trimmed = raw.trim();
  const dataUrlMatch = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1] || mimeType || DEFAULT_IMAGE_MIME_TYPE,
      data: dataUrlMatch[2].replace(/\s/g, ""),
    };
  }

  return {
    mimeType: mimeType || DEFAULT_IMAGE_MIME_TYPE,
    data: trimmed.replace(/\s/g, ""),
  };
}

function decompressOrigElements(origElements: unknown): UnstructuredElement[] {
  if (Array.isArray(origElements)) return origElements;
  if (typeof origElements !== "string" || !origElements) return [];

  const compressed = Buffer.from(origElements, "base64");

  try {
    const jsonBytes = gunzipSync(compressed);
    const parsed = JSON.parse(jsonBytes.toString("utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    try {
      const jsonBytes = inflateSync(compressed);
      const parsed = JSON.parse(jsonBytes.toString("utf-8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export function buildChunkContentData(chunk: UnstructuredElement): ChunkContentData {
  const content: ChunkContentData = {
    text: chunk.text ?? "",
    tables: [],
    images: [],
    types: ["text"],
  };

  const origElements = decompressOrigElements(chunk.metadata?.orig_elements);

  for (const element of origElements) {
    const type = element.type?.toLowerCase() ?? "";

    if (type === "table") {
      const tableContent =
        typeof element.metadata?.text_as_html === "string"
          ? element.metadata.text_as_html
          : (element.text ?? "");
      if (tableContent) {
        content.tables.push(tableContent);
        if (!content.types.includes("table")) content.types.push("table");
      }
      continue;
    }

    if (IMAGE_TYPES.has(type)) {
      const base64 = element.metadata?.image_base64;
      if (typeof base64 === "string" && base64) {
        const mimeType =
          typeof element.metadata?.image_mime_type === "string"
            ? element.metadata.image_mime_type
            : DEFAULT_IMAGE_MIME_TYPE;
        content.images.push(normalizeImageBase64(base64, mimeType));
        if (!content.types.includes("image")) content.types.push("image");
      }
    }
  }

  return content;
}

export function buildDocumentChunks(elements: UnstructuredElement[]): DocumentChunk[] {
  return elements.map((chunk) => ({
    element_id: chunk.element_id ?? null,
    page_number:
      typeof chunk.metadata?.page_number === "number"
        ? chunk.metadata.page_number
        : null,
    content: buildChunkContentData(chunk),
  }));
}
