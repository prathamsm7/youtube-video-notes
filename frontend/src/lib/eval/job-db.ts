import { EvalJobStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { summarizeEvalResults } from "./run-eval";
import type { EvalJobView, EvalResultRow, EvalSummary } from "./types";

type EvalJobWithRun = Prisma.EvalJobGetPayload<{
  include: { evalRun: true };
}>;

const ACTIVE_STATUSES: EvalJobStatus[] = [
  EvalJobStatus.queued,
  EvalJobStatus.running,
  EvalJobStatus.failed,
];

function parsePartialResults(value: Prisma.JsonValue): EvalResultRow[] {
  if (!Array.isArray(value)) return [];
  return value as EvalResultRow[];
}

export function toEvalJobView(job: EvalJobWithRun): EvalJobView {
  const partialResults = parsePartialResults(job.partialResults);
  const summary: EvalSummary | null =
    job.status === EvalJobStatus.completed && partialResults.length > 0
      ? summarizeEvalResults(partialResults)
      : partialResults.length > 0
        ? summarizeEvalResults(partialResults)
        : null;

  return {
    id: job.id,
    youtubeId: job.youtubeId,
    limit: job.limit,
    status: job.status,
    progressDone: job.progressDone,
    progressTotal: job.progressTotal,
    resumeFrom: job.resumeFrom,
    partialResults,
    summary,
    lastError: job.lastError,
    cancelRequested: job.cancelRequested,
    evalRunId: job.evalRunId,
    experimentName: job.evalRun?.experimentName ?? null,
    experimentId: job.evalRun?.experimentId ?? null,
    compareUrl: job.evalRun?.compareUrl ?? null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

export async function findActiveEvalJob() {
  return prisma.evalJob.findFirst({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
    include: { evalRun: true },
  });
}

export async function getEvalJobById(id: string) {
  return prisma.evalJob.findUnique({ where: { id }, include: { evalRun: true } });
}

export async function createEvalJob(params: {
  userId: number;
  youtubeId: string;
  limit: number | null;
  progressTotal: number;
}) {
  return prisma.evalJob.create({
    include: { evalRun: true },
    data: {
      userId: params.userId,
      youtubeId: params.youtubeId,
      limit: params.limit,
      progressTotal: params.progressTotal,
      partialResults: [],
      resumeFrom: 0,
      progressDone: 0,
    },
  });
}

export async function claimEvalJob(jobId: string): Promise<EvalJobWithRun | null> {
  const updated = await prisma.evalJob.updateMany({
    where: {
      id: jobId,
      status: { in: [EvalJobStatus.queued, EvalJobStatus.failed] },
      cancelRequested: false,
    },
    data: {
      status: EvalJobStatus.running,
      startedAt: new Date(),
      lastError: null,
    },
  });

  if (updated.count === 0) return null;
  return getEvalJobById(jobId);
}

export async function claimNextQueuedEvalJob(): Promise<EvalJobWithRun | null> {
  const next = await prisma.evalJob.findFirst({
    where: { status: EvalJobStatus.queued, cancelRequested: false },
    orderBy: { createdAt: "asc" },
  });
  if (!next) return null;
  return claimEvalJob(next.id);
}

export async function updateEvalJobCheckpoint(
  jobId: string,
  params: {
    progressDone: number;
    resumeFrom: number;
    partialResults: EvalResultRow[];
  },
) {
  return prisma.evalJob.update({
    where: { id: jobId },
    data: {
      progressDone: params.progressDone,
      resumeFrom: params.resumeFrom,
      partialResults: params.partialResults,
    },
  });
}

export async function markEvalJobCompleted(
  jobId: string,
  evalRunId: string,
) {
  return prisma.evalJob.update({
    where: { id: jobId },
    data: {
      status: EvalJobStatus.completed,
      evalRunId,
      completedAt: new Date(),
      lastError: null,
    },
  });
}

export async function markEvalJobFailed(jobId: string, error: string) {
  return prisma.evalJob.update({
    where: { id: jobId },
    data: {
      status: EvalJobStatus.failed,
      lastError: error,
    },
  });
}

export async function markEvalJobCancelled(jobId: string) {
  return prisma.evalJob.update({
    where: { id: jobId },
    data: {
      status: EvalJobStatus.cancelled,
      completedAt: new Date(),
    },
  });
}

export async function requestEvalJobCancel(jobId: string) {
  return prisma.evalJob.update({
    where: { id: jobId },
    data: { cancelRequested: true },
  });
}

export async function requeueEvalJob(jobId: string) {
  const updated = await prisma.evalJob.updateMany({
    where: {
      id: jobId,
      status: EvalJobStatus.failed,
    },
    data: {
      status: EvalJobStatus.queued,
      lastError: null,
      cancelRequested: false,
      completedAt: null,
    },
  });

  if (updated.count === 0) return null;
  return getEvalJobById(jobId);
}

export async function isEvalJobCancelled(jobId: string): Promise<boolean> {
  const job = await prisma.evalJob.findUnique({
    where: { id: jobId },
    select: { cancelRequested: true, status: true },
  });
  if (!job) return true;
  return job.cancelRequested || job.status === EvalJobStatus.cancelled;
}
