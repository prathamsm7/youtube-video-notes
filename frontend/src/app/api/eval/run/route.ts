import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveEvalRun } from "@/lib/eval/db";
import { resolveYoutubeId } from "@/lib/eval/resolve-video-id";
import { runVideoEval } from "@/lib/eval/run-eval";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const videoInput = typeof body.videoId === "string" ? body.videoId : "";
  const limitRaw = Number(body.limit ?? 3);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(15, Math.max(1, Math.floor(limitRaw)))
    : 3;

  const videoId = resolveYoutubeId(videoInput);
  if (!videoId) {
    return NextResponse.json(
      { detail: "Provide a valid YouTube URL or 11-character video ID." },
      { status: 400 },
    );
  }

  try {
    const run = await runVideoEval(videoId, limit);

    const saved = await saveEvalRun({
      userId: user.id,
      videoId: run.videoId,
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
