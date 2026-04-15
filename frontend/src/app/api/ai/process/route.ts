import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

if (!process.env.PYTHON_BACKEND_URL) {
  throw new Error("PYTHON_BACKEND_URL environment variable is required. Set it in .env.local");
}
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const response = await fetch(`${PYTHON_BACKEND_URL}/process_video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("AI Process Proxy Error:", error);
    return NextResponse.json({ detail: "AI Backend unreachable" }, { status: 502 });
  }
}
