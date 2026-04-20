import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL;

    if (!PYTHON_BACKEND_URL) {
      return NextResponse.json({ detail: "PYTHON_BACKEND_URL not configured" }, { status: 500 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(`${PYTHON_BACKEND_URL}/process_video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const err = error as Error;
    console.error("AI Process Proxy Error:", err);
    return NextResponse.json({ 
      detail: "AI Backend unreachable", 
      error: err.message,
      target: `${process.env.PYTHON_BACKEND_URL}/process_video`
    }, { status: 502 });
  }
}
