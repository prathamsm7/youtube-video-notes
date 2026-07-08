import { gunzipSync, inflateSync } from "zlib";
import { EXCLUDED_PARTITION_ELEMENTS } from "./excluded-elements";

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
  elementType: string | null;
  caption: string | null;
};

export type ChunkTable = {
  html: string;
  elementType: string | null;
  caption: string | null;
};

export type ChunkContentData = {
  text: string;
  tables: ChunkTable[];
  images: ChunkImage[];
  types: Array<"text" | "table" | "image">;
};

export type DocumentChunk = {
  element_id: string | null;
  page_number: number | null;
  content: ChunkContentData;
};

const IMAGE_TYPES = new Set(["image", "figure", "picture"]);
const CAPTION_TYPES = new Set(["figurecaption", "caption"]);
const DEFAULT_IMAGE_MIME_TYPE = "image/png";
const EXCLUDED_ELEMENT_TYPES = new Set(
  EXCLUDED_PARTITION_ELEMENTS.map((type) => type.toLowerCase()),
);

function isExcludedElementType(type: string): boolean {
  return EXCLUDED_ELEMENT_TYPES.has(type.toLowerCase());
}

function isCaptionElementType(type: string): boolean {
  return CAPTION_TYPES.has(type.toLowerCase());
}

function looksLikeFigureTableCaption(text: string): boolean {
  return /^(?:Figure|Fig\.?|Table)\s*\d+/i.test(text.trim());
}

function captionLinesFromText(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => looksLikeFigureTableCaption(line));
}

/** Attach figure/table labels from chunk text when Unstructured did not emit FigureCaption elements. */
function assignCaptionsFromText(content: ChunkContentData): void {
  const lines = captionLinesFromText(content.text);
  if (!lines.length) return;

  const figureLines = lines.filter((line) => /^(?:Figure|Fig\.?)/i.test(line));
  const tableLines = lines.filter((line) => /^Table\s*\d+/i.test(line));

  const unlabeledImages = content.images.filter((image) => !image.caption);
  if (unlabeledImages.length > 0 && figureLines.length > 0) {
    const caption = figureLines.length === 1 ? figureLines[0] : null;
    for (let i = 0; i < unlabeledImages.length; i += 1) {
      unlabeledImages[i].caption =
        caption ?? figureLines[i] ?? figureLines[figureLines.length - 1];
    }
  }

  const unlabeledTables = content.tables.filter((table) => !table.caption);
  if (unlabeledTables.length > 0 && tableLines.length > 0) {
    const caption = tableLines.length === 1 ? tableLines[0] : null;
    for (let i = 0; i < unlabeledTables.length; i += 1) {
      unlabeledTables[i].caption =
        caption ?? tableLines[i] ?? tableLines[tableLines.length - 1];
    }
  }
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
  const origElements = decompressOrigElements(chunk.metadata?.orig_elements);
  const textParts: string[] = [];
  const tables: ChunkTable[] = [];
  const images: ChunkImage[] = [];
  const types: Array<"text" | "table" | "image"> = [];
  let pendingCaption: { elementType: string; caption: string } | null = null;

  for (const element of origElements) {
    const type = element.type?.toLowerCase() ?? "";
    if (isExcludedElementType(type)) continue;

    if (isCaptionElementType(type)) {
      const caption = element.text?.trim();
      if (caption) {
        pendingCaption = {
          elementType: element.type ?? "FigureCaption",
          caption,
        };
      }
      continue;
    }

    if (type === "table") {
      const html =
        typeof element.metadata?.text_as_html === "string"
          ? element.metadata.text_as_html
          : (element.text ?? "");
      if (!html) continue;

      const elementCaption = element.text?.trim() || null;
      tables.push({
        html,
        elementType: element.type ?? "Table",
        caption: pendingCaption?.caption ?? elementCaption,
      });
      pendingCaption = null;
      if (!types.includes("table")) types.push("table");
      continue;
    }

    if (IMAGE_TYPES.has(type)) {
      const base64 = element.metadata?.image_base64;
      if (typeof base64 !== "string" || !base64) continue;

      const trimmed = base64.trim();
      const dataUrlMatch = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
      const mimeType =
        typeof element.metadata?.image_mime_type === "string"
          ? element.metadata.image_mime_type
          : dataUrlMatch?.[1] || DEFAULT_IMAGE_MIME_TYPE;
      const data = dataUrlMatch
        ? dataUrlMatch[2].replace(/\s/g, "")
        : trimmed.replace(/\s/g, "");

      images.push({
        data,
        mimeType,
        elementType: element.type ?? "Image",
        caption: pendingCaption?.caption ?? null,
      });
      pendingCaption = null;
      if (!types.includes("image")) types.push("image");
      continue;
    }

    const text = element.text?.trim();
    if (text) {
      if (looksLikeFigureTableCaption(text)) {
        pendingCaption = {
          elementType: element.type ?? "FigureCaption",
          caption: text,
        };
      } else {
        textParts.push(text);
      }
    }
  }

  if (pendingCaption?.caption) {
    textParts.push(pendingCaption.caption);
  }

  const content: ChunkContentData = {
    text: textParts.join("\n\n") || (chunk.text ?? ""),
    tables,
    images,
    types: types.length ? types : ["text"],
  };

  assignCaptionsFromText(content);
  return content;
}

export function collectFigureTableCaptions(content: ChunkContentData): string[] {
  const seen = new Set<string>();
  const captions: string[] = [];

  const add = (label: string | null | undefined) => {
    const trimmed = label?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    captions.push(trimmed);
  };

  for (const table of content.tables) add(table.caption);
  for (const image of content.images) add(image.caption);
  for (const line of captionLinesFromText(content.text)) add(line);

  return captions;
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
