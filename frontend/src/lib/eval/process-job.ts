import type { EvalJob } from "@prisma/client";
import { EvalJobStatus } from "@prisma/client";
import { saveEvalRun } from "./db";
import { evaluateOneGolden } from "./evaluate-one";
import {
  claimEvalJob,
  getEvalJobById,
  isEvalJobCancelled,
  markEvalJobCancelled,
  markEvalJobCompleted,
  markEvalJobFailed,
  updateEvalJobCheckpoint,
} from "./job-db";
import { loadEvalDataset } from "./load-dataset";
import { evalCooldownMs, sleep } from "./job-config";
import { recordQueuedEvalExperiment, summarizeEvalResults } from "./run-eval";
import type { EvalResultRow } from "./types";

export type EvalJobCooldown = {
  sleep: (ms: number) => Promise<void>;
};

async function loadJobContext(job: EvalJob) {
  const examples = await loadEvalDataset({
    youtubeId: job.youtubeId,
    limit: job.limit ?? undefined,
  });

  if (examples.length === 0) {
    throw new Error(`No golden dataset found for video ${job.youtubeId}.`);
  }

  const partialResults = Array.isArray(job.partialResults)
    ? (job.partialResults as EvalResultRow[])
    : [];

  let startIndex = job.resumeFrom;
  if (startIndex > examples.length) startIndex = partialResults.length;

  return { examples, startIndex };
}

async function runGoldenLoop(
  job: EvalJob,
  cooldown?: EvalJobCooldown,
): Promise<EvalResultRow[]> {
  const { examples, startIndex } = await loadJobContext(job);
  const cooldownMs = evalCooldownMs();
  const pause = cooldown?.sleep ?? sleep;

  for (let i = startIndex; i < examples.length; i++) {
    if (await isEvalJobCancelled(job.id)) {
      await markEvalJobCancelled(job.id);
      const fresh = await getEvalJobById(job.id);
      return Array.isArray(fresh?.partialResults)
        ? (fresh.partialResults as EvalResultRow[])
        : [];
    }

    const fresh = await getEvalJobById(job.id);
    const partialResults = Array.isArray(fresh?.partialResults)
      ? (fresh!.partialResults as EvalResultRow[])
      : [];

    if (partialResults.length <= i) {
      const row = await evaluateOneGolden(job.youtubeId, examples[i]);
      partialResults.push(row);

      await updateEvalJobCheckpoint(job.id, {
        progressDone: i + 1,
        resumeFrom: i + 1,
        partialResults,
      });
    }

    if (i < examples.length - 1 && cooldownMs > 0) {
      await pause(cooldownMs);
    }
  }

  const done = await getEvalJobById(job.id);
  return Array.isArray(done?.partialResults)
    ? (done.partialResults as EvalResultRow[])
    : [];
}

async function finalizeJob(job: EvalJob, partialResults: EvalResultRow[]) {
  const summary = summarizeEvalResults(partialResults);
  const experiment = await recordQueuedEvalExperiment({
    videoId: job.youtubeId,
    jobId: job.id,
    results: partialResults,
  });
  const evalRun = await saveEvalRun({
    userId: job.userId,
    videoId: job.youtubeId,
    limit: partialResults.length,
    experimentName: experiment.experimentName,
    experimentId: experiment.experimentId,
    compareUrl: experiment.compareUrl,
    summary,
    results: partialResults,
  });

  await markEvalJobCompleted(job.id, evalRun.id);
}

/**
 * Process one eval job sequentially with DB checkpoints after each golden.
 * Optional durable cooldown via Trigger.dev `wait.for`.
 */
export async function processEvalJob(
  jobId: string,
  options?: { cooldown?: EvalJobCooldown },
): Promise<void> {
  const existing = await getEvalJobById(jobId);
  if (!existing) return;

  let job: EvalJob | null = existing;

  if (
    existing.status === EvalJobStatus.queued ||
    existing.status === EvalJobStatus.failed
  ) {
    job = await claimEvalJob(jobId);
    if (!job) return;
  } else if (existing.status !== EvalJobStatus.running) {
    return;
  }

  try {
    const partialResults = await runGoldenLoop(job, options?.cooldown);

    if (await isEvalJobCancelled(jobId)) return;

    const fresh = await getEvalJobById(jobId);
    if (fresh?.evalRunId) return;

    await finalizeJob(job, partialResults);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evaluation failed";
    console.error(`[eval/job] ${jobId} failed:`, error);
    await markEvalJobFailed(jobId, message);
    throw error;
  }
}
