export type EvalExample = {
  question: string;
  referenceAnswer: string;
};

export type EvalDatasetSource = {
  youtubeId?: string | null;
  documentId?: string | null;
};

export type EvalDatasetRecord = EvalDatasetSource & {
  qaPairs: EvalExample[];
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

export type EvalJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type EvalJobView = {
  id: string;
  youtubeId: string;
  limit: number | null;
  status: EvalJobStatus;
  progressDone: number;
  progressTotal: number;
  resumeFrom: number;
  partialResults: EvalResultRow[];
  summary: EvalSummary | null;
  lastError: string | null;
  cancelRequested: boolean;
  evalRunId: string | null;
  experimentName: string | null;
  experimentId: string | null;
  compareUrl: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};
