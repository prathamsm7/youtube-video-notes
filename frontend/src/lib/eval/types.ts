export type EvalExample = {
  question: string;
  referenceAnswer: string;
};

export type EvalPrediction = {
  question: string;
  answer: string;
  retrievedDocuments: string[];
};

export type EvalScores = {
  correctness: number;
  helpfulness: number;
  groundedness: number;
  retrievalRelevance: number;
  contextRecall: number;
};

export type EvalComments = {
  correctness?: string;
  helpfulness?: string;
  groundedness?: string;
  retrievalRelevance?: string;
  contextRecall?: string;
};

export type EvalResultRow = {
  question: string;
  referenceAnswer: string;
  prediction: EvalPrediction;
  scores: EvalScores;
  comments: EvalComments;
};

export type EvalSummary = {
  count: number;
  avgCorrectness: number | null;
  avgHelpfulness: number | null;
  avgGroundedness: number | null;
  avgRetrievalRelevance: number | null;
  avgContextRecall: number | null;
};

export function isPassingEvalScore(score: number): boolean {
  return score >= 0.5;
}
