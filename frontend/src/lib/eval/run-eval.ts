import { randomUUID } from "node:crypto";
import { Client } from "langsmith";
import { evaluate } from "langsmith/evaluation";
import { invokeDocumentQuery } from "@/lib/sources/document/runner";
import { invokeVideoQuery } from "@/lib/sources/video/runner";
import {
  datasetLangSmithName,
  experimentPrefix,
  evalSourceLabel,
  loadDatasetParams,
  type EvalSource,
} from "./eval-source";
import { openEvaluators } from "./evaluators";
import { loadEvalDataset } from "./load-dataset";
import {
  FEEDBACK_TO_SCORE_KEY,
  emptyScores,
} from "./scores";
import type {
  EvalExample,
  EvalComments,
  EvalResultRow,
  EvalScores,
  EvalSummary,
} from "./types";

export async function syncDataset(
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

export async function buildCompareUrl(client: Client, experimentName: string) {
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

export async function recordQueuedEvalExperiment(params: {
  source: EvalSource;
  jobId: string;
  results: EvalResultRow[];
}) {
  const client = new Client();
  // Keep the full golden set in LangSmith so partial runs (e.g. 3/15) compare correctly.
  const allExamples = await loadEvalDataset(loadDatasetParams(params.source));
  const datasetName = await syncDataset(
    client,
    datasetLangSmithName(params.source),
    allExamples.length > 0
      ? allExamples
      : params.results.map((row) => ({
          question: row.question,
          referenceAnswer: row.referenceAnswer,
        })),
  );
  const dataset = await client.readDataset({ datasetName });

  const exampleByQuestion = new Map<string, string>();
  for await (const example of client.listExamples({ datasetId: dataset.id })) {
    const question =
      typeof example.inputs?.question === "string" ? example.inputs.question : null;
    if (question) exampleByQuestion.set(question, example.id);
  }

  const experimentName = `${experimentPrefix(params.source)}-job-${params.jobId}`;
  await getOrCreateQueuedEvalProject(client, {
    experimentName,
    datasetId: dataset.id,
    source: params.source,
    jobId: params.jobId,
  });

  for (const [index, result] of params.results.entries()) {
    const runId = randomUUID();
    const now = new Date();

    await client.createRun({
      id: runId,
      name: "docuvision_eval",
      run_type: "chain",
      project_name: experimentName,
      reference_example_id: exampleByQuestion.get(result.question),
      inputs: { question: result.question },
      outputs: {
        answer: result.prediction.answer,
        retrievedDocuments: result.prediction.retrievedDocuments,
      },
      start_time: now.toISOString(),
      end_time: now.toISOString(),
      extra: {
        metadata: {
          ...(params.source.kind === "video"
            ? { videoId: params.source.id }
            : { documentId: params.source.id }),
          jobId: params.jobId,
          rowIndex: index,
        },
      },
    } as never);

    for (const feedback of toLangSmithFeedback(result)) {
      await client.createFeedback(runId, feedback.key, {
        score: feedback.score,
        comment: feedback.comment,
      });
    }
  }

  const { compareUrl, experimentId } = await buildCompareUrl(client, experimentName);
  return { experimentName, experimentId, compareUrl };
}

async function getOrCreateQueuedEvalProject(
  client: Client,
  params: {
    experimentName: string;
    datasetId: string;
    source: EvalSource;
    jobId: string;
  },
) {
  try {
    return await client.createProject({
      projectName: params.experimentName,
      description: "Queued DocuVision eval job",
      metadata: {
        ...(params.source.kind === "video"
          ? { videoId: params.source.id }
          : { documentId: params.source.id }),
        jobId: params.jobId,
        source: "eval-job",
      },
      referenceDatasetId: params.datasetId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("409") && !message.includes("Session already exists")) {
      throw error;
    }

    return client.readProject({ projectName: params.experimentName });
  }
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

function toLangSmithFeedback(result: EvalResultRow) {
  return [
    {
      key: "correctness",
      score: result.scores.correctness,
      comment: result.comments.correctness,
    },
    {
      key: "helpfulness",
      score: result.scores.helpfulness,
      comment: result.comments.helpfulness,
    },
    {
      key: "groundedness",
      score: result.scores.groundedness,
      comment: result.comments.groundedness,
    },
    {
      key: "retrieval_relevance",
      score: result.scores.retrievalRelevance,
      comment: result.comments.retrievalRelevance,
    },
    {
      key: "context_recall",
      score: result.scores.contextRecall,
      comment: result.comments.contextRecall,
    },
  ];
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

async function invokeEvalQuery(source: EvalSource, question: string) {
  if (source.kind === "video") {
    return invokeVideoQuery(source.id, question);
  }
  return invokeDocumentQuery(source.id, question);
}

async function runEvalForSource(source: EvalSource, limit = 3) {
  const client = new Client();
  const examples = await loadEvalDataset({ limit, ...loadDatasetParams(source) });

  if (examples.length === 0) {
    throw new Error(`No golden dataset found for ${evalSourceLabel(source)}.`);
  }

  const datasetName = await syncDataset(
    client,
    datasetLangSmithName(source),
    examples,
  );

  const experiment = await evaluate(
    async (inputs: { question: string }) => {
      const result = await invokeEvalQuery(source, inputs.question);
      return {
        answer: result.answer,
        retrievedDocuments: result.retrievedDocuments,
      };
    },
    {
      client,
      data: datasetName,
      evaluators: openEvaluators,
      experimentPrefix: experimentPrefix(source),
      maxConcurrency: 2,
      metadata:
        source.kind === "video"
          ? { videoId: source.id }
          : { documentId: source.id },
    },
  );

  const results = toResultRows(experiment);
  const { compareUrl, experimentId } = await buildCompareUrl(
    client,
    experiment.experimentName,
  );

  return {
    source,
    limit: results.length,
    experimentName: experiment.experimentName,
    experimentId,
    compareUrl,
    summary: summarizeEvalResults(results),
    results,
  };
}

export async function runVideoEval(videoId: string, limit = 3) {
  const run = await runEvalForSource({ kind: "video", id: videoId }, limit);
  return {
    videoId,
    limit: run.limit,
    experimentName: run.experimentName,
    experimentId: run.experimentId,
    compareUrl: run.compareUrl,
    summary: run.summary,
    results: run.results,
  };
}

export async function runDocumentEval(documentId: string, limit = 3) {
  const run = await runEvalForSource({ kind: "document", id: documentId }, limit);
  return {
    documentId,
    limit: run.limit,
    experimentName: run.experimentName,
    experimentId: run.experimentId,
    compareUrl: run.compareUrl,
    summary: run.summary,
    results: run.results,
  };
}
