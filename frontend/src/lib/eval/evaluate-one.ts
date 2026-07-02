import { invokeVideoQuery } from "@/lib/sources/video/runner";
import { runEvaluatorsForExample } from "./evaluators";
import { sleep } from "./job-config";
import type { EvalExample, EvalResultRow } from "./types";

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.toLowerCase().includes("rate limit");
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === maxAttempts - 1) throw error;
      await sleep(2 ** attempt * 2000);
    }
  }
  throw lastError;
}

/** Run RAG + all judges for a single golden example. */
export async function evaluateOneGolden(
  videoId: string,
  example: EvalExample,
): Promise<EvalResultRow> {
  const inputs = { question: example.question };
  const referenceOutputs = { answer: example.referenceAnswer };

  const rag = await withRetry(() => invokeVideoQuery(videoId, example.question));
  const outputs = {
    answer: rag.answer,
    retrievedDocuments: rag.retrievedDocuments,
  };

  const { scores, comments } = await withRetry(() =>
    runEvaluatorsForExample({ inputs, outputs, referenceOutputs }),
  );

  return {
    question: example.question,
    referenceAnswer: example.referenceAnswer,
    prediction: {
      question: example.question,
      answer: outputs.answer,
      retrievedDocuments: outputs.retrievedDocuments,
    },
    scores,
    comments,
  };
}
