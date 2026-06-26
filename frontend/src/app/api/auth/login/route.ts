import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, setAuthCookie } from "@/lib/auth-session";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ detail: "Missing email or password" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
      return NextResponse.json({ detail: "Invalid email or password" }, { status: 401 });
    }

    const token = await createSessionToken(user.id);
    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error("Login error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
