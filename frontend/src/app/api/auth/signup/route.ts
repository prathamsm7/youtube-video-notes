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

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ detail: "Email already registered" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        hashedPassword,
      },
    });

    const token = await createSessionToken(newUser.id);
    const response = NextResponse.json({
      user: { id: newUser.id, email: newUser.email },
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error("Signup error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
