import { Client } from "langsmith";
import { evaluate } from "langsmith/evaluation";
import { invokeVideoQuery } from "@/lib/sources/video/runner";
import { openEvaluators } from "./evaluators";
import { loadEvalDataset } from "./load-dataset";
import type {
  EvalExample,
  EvalComments,
  EvalResultRow,
  EvalScores,
  EvalSummary,
} from "./types";

const FEEDBACK_TO_SCORE_KEY: Record<string, keyof EvalScores> = {
  correctness: "correctness",
  helpfulness: "helpfulness",
  groundedness: "groundedness",
  retrieval_relevance: "retrievalRelevance",
  context_recall: "contextRecall",
};

function emptyScores(): EvalScores {
  return {
    correctness: 0,
    helpfulness: 0,
    groundedness: 0,
    retrievalRelevance: 0,
    contextRecall: 0,
  };
}

async function syncDataset(
  client: Client,
  datasetName: string,
  examples: EvalExample[],
) {
  let dataset;
  try {
    dataset = await client.readDataset({ datasetName });
  } catch {
    dataset = await client.createDataset(datasetName, {
      description: "DocuVision eval examples synced from the source dataset",
    });
  }

  const existingIds: string[] = [];
  for await (const example of client.listExamples({ datasetId: dataset.id })) {
    existingIds.push(example.id);
  }
  if (existingIds.length > 0) {
    await client.deleteExamples(existingIds);
  }

  if (examples.length > 0) {
    await client.createExamples({
      inputs: examples.map((row) => ({ question: row.question })),
      outputs: examples.map((row) => ({ answer: row.referenceAnswer })),
      datasetId: dataset.id,
    });
  }

  return dataset.name;
}

async function buildCompareUrl(client: Client, experimentName: string) {
  const project = await client.readProject({ projectName: experimentName });
  const datasetId = project.reference_dataset_id;

  if (!datasetId) {
    return {
      compareUrl: "https://smith.langchain.com",
      experimentId: project.id,
    };
  }

  const datasetUrl = await client.getDatasetUrl({ datasetId });
  return {
    compareUrl: `${datasetUrl}/compare?selectedSessions=${project.id}`,
    experimentId: project.id,
  };
}

function toResultRows(
  experiment: Awaited<ReturnType<typeof evaluate>>,
): EvalResultRow[] {
  return experiment.results.map((row) => {
    const scores = emptyScores();
    const comments: EvalComments = {};

    for (const feedback of row.evaluationResults.results) {
      const scoreKey = FEEDBACK_TO_SCORE_KEY[feedback.key];
      if (!scoreKey) continue;
      if (typeof feedback.score === "number") scores[scoreKey] = feedback.score;
      if (feedback.comment) comments[scoreKey] = feedback.comment;
    }

    const question = String(row.example.inputs.question ?? "");
    return {
      question,
      referenceAnswer: String(row.example.outputs?.answer ?? ""),
      prediction: {
        question,
        answer: String(row.run.outputs?.answer ?? ""),
        retrievedDocuments:
          (row.run.outputs?.retrievedDocuments as string[] | undefined) ?? [],
      },
      scores,
      comments,
    };
  });
}

export function summarizeEvalResults(results: EvalResultRow[]): EvalSummary | null {
  if (!results.length) return null;

  const avg = (key: keyof EvalScores) =>
    results.reduce((sum, row) => sum + row.scores[key], 0) / results.length;

  return {
    count: results.length,
    avgCorrectness: avg("correctness"),
    avgHelpfulness: avg("helpfulness"),
    avgGroundedness: avg("groundedness"),
    avgRetrievalRelevance: avg("retrievalRelevance"),
    avgContextRecall: avg("contextRecall"),
  };
}

export async function runVideoEval(videoId: string, limit = 3) {
  const client = new Client();
  const examples = await loadEvalDataset({ limit, youtubeId: videoId });

  if (examples.length === 0) {
    throw new Error(`No golden dataset found for video ${videoId}.`);
  }

  const datasetName = await syncDataset(
    client,
    `docuvision-eval-video-${videoId}`,
    examples,
  );

  const experiment = await evaluate(
    async (inputs: { question: string }) => {
      const result = await invokeVideoQuery(videoId, inputs.question);
      return {
        answer: result.answer,
        retrievedDocuments: result.retrievedDocuments,
      };
    },
    {
      client,
      data: datasetName,
      evaluators: openEvaluators,
      experimentPrefix: `docuvision-video-${videoId}`,
      maxConcurrency: 2,
      metadata: { videoId },
    },
  );

  const results = toResultRows(experiment);
  const { compareUrl, experimentId } = await buildCompareUrl(
    client,
    experiment.experimentName,
  );

  return {
    videoId,
    limit: results.length,
    experimentName: experiment.experimentName,
    experimentId,
    compareUrl,
    summary: summarizeEvalResults(results),
    results,
  };
}
