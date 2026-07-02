import { task, wait } from "@trigger.dev/sdk";
import { processEvalJob } from "@/lib/eval/process-job";

export const runEvalJobTask = task({
  id: "run-eval-job",
  queue: {
    name: "eval-jobs",
    concurrencyLimit: 1,
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 60_000,
  },
  maxDuration: 7200,
  run: async (payload: { jobId: string }) => {
    await processEvalJob(payload.jobId, {
      cooldown: {
        sleep: async (ms) => {
          if (ms <= 0) return;
          const seconds = Math.max(1, Math.ceil(ms / 1000));
          await wait.for({ seconds });
        },
      },
    });
  },
});
