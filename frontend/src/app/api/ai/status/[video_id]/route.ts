import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ video_id: string }> },
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    const { video_id } = await params;
    const response = await fetch(`${PYTHON_BACKEND_URL}/status/${video_id}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { detail: "Status lookup failed" },
        { status: response.status },
      );
    }
    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Status proxy error:", error);
    return NextResponse.json(
      { detail: "Status backend unreachable" },
      { status: 502 },
    );
  }
}
