import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const response = await fetch(`${PYTHON_BACKEND_URL}/ask`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        // No need to pass the Next.js JWT to Python anymore as the proxy handles auth
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("AI Ask Proxy Error:", error);
    return NextResponse.json({ detail: "AI Backend unreachable" }, { status: 502 });
  }
}
