import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findActiveEvalJob, toEvalJobView } from "@/lib/eval/job-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const job = await findActiveEvalJob();
  if (!job) {
    return NextResponse.json({ job: null });
  }

  return NextResponse.json({ job: toEvalJobView(job) });
}
