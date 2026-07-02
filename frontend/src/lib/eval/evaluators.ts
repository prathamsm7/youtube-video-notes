import {
  CORRECTNESS_PROMPT,
  RAG_GROUNDEDNESS_PROMPT,
  RAG_HELPFULNESS_PROMPT,
  RAG_RETRIEVAL_RELEVANCE_PROMPT,
  createLLMAsJudge,
} from "openevals";
import type { EvaluatorT } from "langsmith/evaluation";
import { createOpenAIChatModel } from "@/lib/core/rag/clients/gemini";
import { CHAT_MODEL_EVALUATOR } from "@/lib/core/rag/constants";
import { CONTEXT_RECALL_PROMPT } from "./context-recall-prompt";
import { applyFeedbackToRow, emptyScores } from "./scores";
import { evalJudgeGapMs, sleep } from "./job-config";
import type { EvalComments, EvalScores } from "./types";

type EvaluatorParams = {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  referenceOutputs?: Record<string, unknown>;
};

/** Structured output schema — LLM must return a numeric score and short comment. */
const EVAL_SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: {
      type: "number",
      description:
        "How well the output meets the criteria, from 0.0 to 1.0. 1.0 is perfect, 0.0 is not met at all.",
    },
    comment: {
      type: "string",
      description: "Brief explanation for the score.",
    },
  },
  required: ["score", "comment"],
  additionalProperties: false,
};

// o4-mini only supports the default temperature (1), not 0.
const judge = createOpenAIChatModel(CHAT_MODEL_EVALUATOR, 1, { nostream: true });

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score));
}

function documentsFrom(params: EvaluatorParams): string[] {
  return (params.outputs.retrievedDocuments as string[] | undefined) ?? [];
}

function createEvaluator(
  key: string,
  prompt: string,
  buildJudgeInputs: (params: EvaluatorParams) => Record<string, unknown>,
): EvaluatorT {
  const llmJudge = createLLMAsJudge({
    prompt,
    feedbackKey: key,
    judge,
    outputSchema: EVAL_SCORE_SCHEMA,
    useReasoning: false,
  });

  return async (params: EvaluatorParams) => {
    const result = (await llmJudge(
      buildJudgeInputs(params),
    )) as { score: number; comment: string };

    return {
      key,
      score: clampScore(result.score),
      comment: result.comment,
    };
  };
}

const EVALUATOR_CONFIGS = [
  {
    key: "correctness",
    prompt: CORRECTNESS_PROMPT,
    buildJudgeInputs: (params: EvaluatorParams) => ({
      inputs: String(params.inputs.question ?? params.inputs),
      outputs: String(params.outputs.answer ?? params.outputs),
      referenceOutputs: String(
        params.referenceOutputs?.answer ?? params.referenceOutputs ?? "",
      ),
    }),
  },
  {
    key: "helpfulness",
    prompt: RAG_HELPFULNESS_PROMPT,
    buildJudgeInputs: (params: EvaluatorParams) => ({
      inputs: params.inputs,
      outputs: { answer: params.outputs.answer },
    }),
  },
  {
    key: "groundedness",
    prompt: RAG_GROUNDEDNESS_PROMPT,
    buildJudgeInputs: (params: EvaluatorParams) => ({
      context: { documents: documentsFrom(params) },
      outputs: { answer: params.outputs.answer },
    }),
  },
  {
    key: "retrieval_relevance",
    prompt: RAG_RETRIEVAL_RELEVANCE_PROMPT,
    buildJudgeInputs: (params: EvaluatorParams) => ({
      inputs: params.inputs,
      context: { documents: documentsFrom(params) },
    }),
  },
  {
    key: "context_recall",
    prompt: CONTEXT_RECALL_PROMPT,
    buildJudgeInputs: (params: EvaluatorParams) => ({
      inputs: params.inputs,
      context: { documents: documentsFrom(params) },
      referenceOutputs: String(
        params.referenceOutputs?.answer ?? params.referenceOutputs ?? "",
      ),
    }),
  },
] as const;

export type EvaluatorInput = {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  referenceOutputs?: Record<string, unknown>;
};

type JudgeResult = {
  key: string;
  score: number | boolean;
  comment?: string;
};

type RunnableEvaluator = (
  params: EvaluatorInput,
) => Promise<JudgeResult | JudgeResult[]>;

export const openEvaluators: EvaluatorT[] = EVALUATOR_CONFIGS.map(
  ({ key, prompt, buildJudgeInputs }) => createEvaluator(key, prompt, buildJudgeInputs),
);

/** Run all LLM judges for one golden example (no LangSmith run wrapper). */
export async function runEvaluatorsForExample(
  params: EvaluatorInput,
): Promise<{ scores: EvalScores; comments: EvalComments }> {
  const scores = emptyScores();
  const comments: EvalComments = {};
  const judgeGap = evalJudgeGapMs();

  for (const evaluator of openEvaluators) {
    const feedback = await (evaluator as RunnableEvaluator)(params);
    const items = Array.isArray(feedback) ? feedback : [feedback];
    for (const item of items) {
      applyFeedbackToRow(scores, comments, item);
    }
    if (judgeGap > 0) await sleep(judgeGap);
  }

  return { scores, comments };
}
