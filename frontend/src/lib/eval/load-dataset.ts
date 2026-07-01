import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EvalExample } from "./types";

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
    Array<{ question: string; referenceAnswer: string }>
  >`
    SELECT question, "referenceAnswer"
    FROM "EvalExample"
    WHERE ${sourceFilter}
    ORDER BY "sortOrder" ASC
    ${typeof limit === "number" ? Prisma.sql`LIMIT ${limit}` : Prisma.empty}
  `;

  return rows;
}
