import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createEvalJob,
  findActiveEvalJob,
  toEvalJobView,
} from "@/lib/eval/job-db";
import { loadEvalDataset } from "@/lib/eval/load-dataset";
import { resolveYoutubeId } from "@/lib/eval/resolve-video-id";
import { scheduleEvalJob } from "@/lib/eval/schedule-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const videoInput = typeof body.videoId === "string" ? body.videoId : "";
  const full = body.full === true;

  let limit: number | null = null;
  if (!full) {
    const limitRaw = Number(body.limit ?? 3);
    limit = Number.isFinite(limitRaw)
      ? Math.min(50, Math.max(1, Math.floor(limitRaw)))
      : 3;
  }

  const videoId = resolveYoutubeId(videoInput);
  if (!videoId) {
    return NextResponse.json(
      { detail: "Provide a valid YouTube URL or 11-character video ID." },
      { status: 400 },
    );
  }

  const active = await findActiveEvalJob();
  if (active) {
    return NextResponse.json(
      {
        detail:
          "An evaluation is already in progress or awaiting resume. Finish or cancel it before starting a new one.",
        activeJobId: active.id,
      },
      { status: 409 },
    );
  }

  const examples = await loadEvalDataset({
    youtubeId: videoId,
    limit: limit ?? undefined,
  });

  if (examples.length === 0) {
    return NextResponse.json(
      { detail: `No golden dataset found for video ${videoId}.` },
      { status: 400 },
    );
  }

  try {
    const job = await createEvalJob({
      userId: user.id,
      youtubeId: videoId,
      limit,
      progressTotal: examples.length,
    });

    scheduleEvalJob(job.id);

    return NextResponse.json(toEvalJobView(job), { status: 202 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { detail: "An evaluation is already in progress." },
        { status: 409 },
      );
    }
    console.error("[api/eval/jobs] create failed:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Failed to create job" },
      { status: 500 },
    );
  }
}
