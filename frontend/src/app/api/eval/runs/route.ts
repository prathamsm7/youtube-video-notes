import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listEvalRuns } from "@/lib/eval/db";
import {
  encodeEvalJobSourceId,
  resolveEvalSourceFromInput,
} from "@/lib/eval/eval-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const sourceInput =
    req.nextUrl.searchParams.get("videoId") ??
    req.nextUrl.searchParams.get("documentId") ??
    req.nextUrl.searchParams.get("sourceId") ??
    "";
  const source = sourceInput ? resolveEvalSourceFromInput(sourceInput) : null;

  const runs = await listEvalRuns(
    user.id,
    source ? encodeEvalJobSourceId(source) : undefined,
  );

  return NextResponse.json({
    runs: runs.map((run) => ({
      id: run.id,
      youtubeId: run.youtubeId,
      limit: run.limit,
      experimentName: run.experimentName,
      experimentId: run.experimentId,
      compareUrl: run.compareUrl,
      summary: run.summary,
      createdAt: run.createdAt.toISOString(),
    })),
  });
}
