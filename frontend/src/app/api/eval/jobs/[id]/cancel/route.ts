import { EvalJobStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getEvalJobById,
  markEvalJobCancelled,
  requestEvalJobCancel,
  toEvalJobView,
} from "@/lib/eval/job-db";

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

  if (
    job.status === EvalJobStatus.completed ||
    job.status === EvalJobStatus.cancelled
  ) {
    return NextResponse.json(
      { detail: "This job is already finished." },
      { status: 400 },
    );
  }

  if (
    job.status === EvalJobStatus.queued ||
    job.status === EvalJobStatus.failed
  ) {
    await markEvalJobCancelled(id);
  } else {
    await requestEvalJobCancel(id);
  }

  const refreshed = await getEvalJobById(id);
  return NextResponse.json(toEvalJobView(refreshed!));
}
