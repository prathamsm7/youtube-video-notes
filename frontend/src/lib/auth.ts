import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "./db";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required. Set it in .env.local");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function getCurrentUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub) return null;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(payload.sub) },
    });

    return user;
  } catch (error) {
    return null;
  }
}
