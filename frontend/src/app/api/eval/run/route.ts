import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveEvalRun } from "@/lib/eval/db";
import { findActiveEvalJob } from "@/lib/eval/job-db";
import {
  encodeEvalJobSourceId,
  resolveEvalSource,
} from "@/lib/eval/eval-source";
import { runDocumentEval, runVideoEval } from "@/lib/eval/run-eval";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const active = await findActiveEvalJob();
  if (active) {
    return NextResponse.json(
      {
        detail:
          "An evaluation job is active. Use POST /api/eval/jobs for background runs.",
        activeJobId: active.id,
      },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const source = resolveEvalSource({
    videoId: typeof body.videoId === "string" ? body.videoId : undefined,
    documentId: typeof body.documentId === "string" ? body.documentId : undefined,
  });
  const limitRaw = Number(body.limit ?? 3);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(15, Math.max(1, Math.floor(limitRaw)))
    : 3;

  if (!source) {
    return NextResponse.json(
      {
        detail:
          "Provide a valid YouTube URL/ID or document ID (not both).",
      },
      { status: 400 },
    );
  }

  try {
    const run =
      source.kind === "video"
        ? await runVideoEval(source.id, limit)
        : await runDocumentEval(source.id, limit);

    const saved = await saveEvalRun({
      userId: user.id,
      videoId: encodeEvalJobSourceId(source),
      limit: run.limit,
      experimentName: run.experimentName,
      experimentId: run.experimentId,
      compareUrl: run.compareUrl,
      summary: run.summary,
      results: run.results,
    });

    return NextResponse.json({
      id: saved.id,
      createdAt: saved.createdAt.toISOString(),
      sourceKind: source.kind,
      sourceId: source.id,
      videoId: source.kind === "video" ? source.id : undefined,
      documentId: source.kind === "document" ? source.id : undefined,
      ...run,
    });
  } catch (error) {
    console.error("[api/eval/run] failed:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Evaluation failed" },
      { status: 500 },
    );
  }
}
