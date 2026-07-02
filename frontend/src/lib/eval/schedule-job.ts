import { tasks } from "@trigger.dev/sdk";
import type { runEvalJobTask } from "@/trigger/run-eval-job";
import { processEvalJob } from "./process-job";

const inFlight = new Set<string>();

/**
 * Dispatch eval job processing via Trigger.dev.
 * Falls back to inline processing when EVAL_USE_INLINE_WORKER=true or Trigger is unavailable.
 */
export async function scheduleEvalJob(jobId: string) {
  if (process.env.EVAL_USE_INLINE_WORKER === "true") {
    scheduleInline(jobId);
    return;
  }

  if (!process.env.TRIGGER_SECRET_KEY) {
    console.warn(
      `[eval/schedule] TRIGGER_SECRET_KEY not set; running job ${jobId} inline.`,
    );
    scheduleInline(jobId);
    return;
  }

  try {
    await tasks.trigger<typeof runEvalJobTask>("run-eval-job", { jobId });
  } catch (error) {
    console.warn(
      `[eval/schedule] Trigger.dev send failed for ${jobId}, falling back to inline:`,
      error,
    );
    scheduleInline(jobId);
  }
}

function scheduleInline(jobId: string) {
  if (inFlight.has(jobId)) return;
  inFlight.add(jobId);

  void processEvalJob(jobId)
    .catch((err) => {
      console.error(`[eval/schedule] inline job ${jobId} error:`, err);
    })
    .finally(() => {
      inFlight.delete(jobId);
    });
}

/** Process the oldest queued job (scripts/eval-worker.ts fallback). */
export async function processNextQueuedEvalJob(): Promise<boolean> {
  const { claimNextQueuedEvalJob } = await import("./job-db");
  const job = await claimNextQueuedEvalJob();
  if (!job) return false;
  await processEvalJob(job.id);
  return true;
}

/** Poll loop when Trigger.dev dev server is not running. */
export async function runEvalWorkerLoop(pollMs = 3000): Promise<never> {
  const { sleep } = await import("./job-config");
  while (true) {
    const processed = await processNextQueuedEvalJob();
    if (!processed) await sleep(pollMs);
  }
}
