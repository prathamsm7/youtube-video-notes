import { resolveYoutubeId } from "./resolve-video-id";

export type EvalSource =
  | { kind: "video"; id: string }
  | { kind: "document"; id: string };

const DOC_EVAL_PREFIX = "doc:";
const CUID_RE = /^c[a-z0-9]{24}$/i;

/** Accept a Prisma cuid document ID. */
export function resolveDocumentId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  return CUID_RE.test(trimmed) ? trimmed : null;
}

export function resolveEvalSource(body: {
  videoId?: string;
  documentId?: string;
}): EvalSource | null {
  const documentId =
    typeof body.documentId === "string" ? resolveDocumentId(body.documentId) : null;
  const videoId =
    typeof body.videoId === "string" ? resolveYoutubeId(body.videoId) : null;

  if (documentId && videoId) return null;
  if (documentId) return { kind: "document", id: documentId };
  if (videoId) return { kind: "video", id: videoId };
  return null;
}

export function resolveEvalSourceFromInput(input: string): EvalSource | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const documentId = resolveDocumentId(trimmed);
  if (documentId) return { kind: "document", id: documentId };

  const videoId = resolveYoutubeId(trimmed);
  if (videoId) return { kind: "video", id: videoId };

  return null;
}

/** Store video or document source in EvalJob/EvalRun.youtubeId. */
export function encodeEvalJobSourceId(source: EvalSource): string {
  return source.kind === "document" ? `${DOC_EVAL_PREFIX}${source.id}` : source.id;
}

export function decodeEvalJobSourceId(stored: string): EvalSource {
  if (stored.startsWith(DOC_EVAL_PREFIX)) {
    return { kind: "document", id: stored.slice(DOC_EVAL_PREFIX.length) };
  }
  return { kind: "video", id: stored };
}

export function loadDatasetParams(source: EvalSource) {
  return source.kind === "video"
    ? { youtubeId: source.id }
    : { documentId: source.id };
}

export function datasetLangSmithName(source: EvalSource): string {
  return source.kind === "video"
    ? `docuvision-eval-video-${source.id}`
    : `docuvision-eval-document-${source.id}`;
}

export function experimentPrefix(source: EvalSource): string {
  return source.kind === "video"
    ? `docuvision-video-${source.id}`
    : `docuvision-document-${source.id}`;
}

export function evalSourceLabel(source: EvalSource): string {
  return source.kind === "video" ? `video ${source.id}` : `document ${source.id}`;
}
