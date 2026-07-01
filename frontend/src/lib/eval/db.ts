import { prisma } from "@/lib/db";
import type { EvalResultRow, EvalSummary } from "./types";

export async function saveEvalRun(params: {
  userId: number;
  videoId: string;
  limit: number;
  experimentName: string;
  experimentId: string;
  compareUrl: string;
  summary: EvalSummary | null;
  results: EvalResultRow[];
}) {
  return prisma.evalRun.create({
    data: {
      userId: params.userId,
      youtubeId: params.videoId,
      limit: params.limit,
      experimentName: params.experimentName,
      experimentId: params.experimentId,
      compareUrl: params.compareUrl,
      summary: params.summary ?? {},
      results: params.results,
    },
  });
}

export async function listEvalRuns(userId: number, youtubeId?: string) {
  return prisma.evalRun.findMany({
    where: {
      userId,
      ...(youtubeId ? { youtubeId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      youtubeId: true,
      limit: true,
      experimentName: true,
      experimentId: true,
      compareUrl: true,
      summary: true,
      createdAt: true,
    },
  });
}
