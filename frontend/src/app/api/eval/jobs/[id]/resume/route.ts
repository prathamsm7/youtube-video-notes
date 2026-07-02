import { EvalJobStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  findActiveEvalJob,
  getEvalJobById,
  requeueEvalJob,
  toEvalJobView,
} from "@/lib/eval/job-db";
import { scheduleEvalJob } from "@/lib/eval/schedule-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const job = await getEvalJobById(id);

  if (!job || job.userId !== user.id) {
    return NextResponse.json({ detail: "Job not found" }, { status: 404 });
  }

  if (job.status !== EvalJobStatus.failed) {
    return NextResponse.json(
      { detail: "Only failed jobs can be resumed." },
      { status: 400 },
    );
  }

  const active = await findActiveEvalJob();
  if (active && active.id !== id) {
    return NextResponse.json(
      { detail: "Another evaluation is already active." },
      { status: 409 },
    );
  }

  const updated = await requeueEvalJob(id);
  if (!updated) {
    return NextResponse.json(
      { detail: "Could not resume this job." },
      { status: 400 },
    );
  }

  scheduleEvalJob(id);

  const refreshed = await getEvalJobById(id);
  return NextResponse.json(toEvalJobView(refreshed!));
}
