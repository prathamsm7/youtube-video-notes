import type { EvalComments, EvalScores } from "./types";

export const FEEDBACK_TO_SCORE_KEY: Record<string, keyof EvalScores> = {
  correctness: "correctness",
  helpfulness: "helpfulness",
  groundedness: "groundedness",
  retrieval_relevance: "retrievalRelevance",
  context_recall: "contextRecall",
};

export function emptyScores(): EvalScores {
  return {
    correctness: 0,
    helpfulness: 0,
    groundedness: 0,
    retrievalRelevance: 0,
    contextRecall: 0,
  };
}

export function applyFeedbackToRow(
  scores: EvalScores,
  comments: EvalComments,
  feedback: { key: string; score?: number | boolean; comment?: string },
) {
  const scoreKey = FEEDBACK_TO_SCORE_KEY[feedback.key];
  if (!scoreKey) return;
  if (typeof feedback.score === "number") scores[scoreKey] = feedback.score;
  if (feedback.comment) comments[scoreKey] = feedback.comment;
}
