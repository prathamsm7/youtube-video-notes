#!/usr/bin/env tsx
/**
 * Polls the database for queued eval jobs and processes them sequentially.
 *
 * Usage: npm run eval:worker
 *
 * Run alongside `npm run dev` in a second terminal for reliable background evals.
 */
import { runEvalWorkerLoop } from "../src/lib/eval/schedule-job";

const pollMs = Number(process.env.EVAL_WORKER_POLL_MS ?? 3000);

console.log(`[eval-worker] polling every ${pollMs}ms`);

runEvalWorkerLoop(pollMs).catch((error) => {
  console.error("[eval-worker] fatal:", error);
  process.exit(1);
});
