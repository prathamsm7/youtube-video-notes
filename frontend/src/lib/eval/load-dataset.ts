import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EvalDatasetRecord, EvalExample } from "./types";

type LoadEvalDatasetParams = {
  limit?: number;
  youtubeId?: string;
  documentId?: string;
};

/** Load golden Q&A examples from the database. */
export async function loadEvalDataset({
  limit,
  youtubeId,
  documentId,
}: LoadEvalDatasetParams): Promise<EvalExample[]> {
  if (!youtubeId && !documentId) {
    throw new Error("A video or document dataset key is required.");
  }

  const sourceFilter =
    youtubeId !== undefined
      ? Prisma.sql`"youtubeId" = ${youtubeId}`
      : Prisma.sql`"documentId" = ${documentId!}`;

  const rows = await prisma.$queryRaw<
    Array<{
      youtubeId: string | null;
      documentId: string | null;
      qaPairs: Prisma.JsonValue;
    }>
  >`
    SELECT "youtubeId", "documentId", "qaPairs"
    FROM "EvalDataset"
    WHERE ${sourceFilter}
    LIMIT 1
  `;

  const record = rows[0];
  if (!record) return [];

  return parseEvalDatasetRecord(record).slice(
    0,
    typeof limit === "number" ? limit : undefined,
  );
}

function parseEvalDatasetRecord(row: {
  youtubeId: string | null;
  documentId: string | null;
  qaPairs: Prisma.JsonValue;
}): EvalExample[] {
  const record: EvalDatasetRecord = {
    youtubeId: row.youtubeId,
    documentId: row.documentId,
    qaPairs: parseQaPairs(row.qaPairs),
  };

  return record.qaPairs;
}

function parseQaPairs(value: Prisma.JsonValue): EvalExample[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const question =
      "question" in item && typeof item.question === "string" ? item.question : null;
    const referenceAnswer =
      "referenceAnswer" in item && typeof item.referenceAnswer === "string"
        ? item.referenceAnswer
        : null;

    return question && referenceAnswer ? [{ question, referenceAnswer }] : [];
  });
}
