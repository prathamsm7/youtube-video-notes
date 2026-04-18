import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";


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
    const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL;
    
    if (!PYTHON_BACKEND_URL) {
      return NextResponse.json({ detail: "PYTHON_BACKEND_URL not configured" }, { status: 500 });
    }

    const response = await fetch(`${PYTHON_BACKEND_URL}/status/${video_id}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { detail: "Status lookup failed", error: errorText },
        { status: response.status },
      );
    }
    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const err = error as Error;
    console.error("Status proxy error:", err);
    return NextResponse.json(
      { 
        detail: "Status backend unreachable",
        error: err.message,
        target: `${process.env.PYTHON_BACKEND_URL}/status`
      },
      { status: 502 },
    );
  }
}
