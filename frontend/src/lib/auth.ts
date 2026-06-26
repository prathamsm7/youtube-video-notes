import { NextRequest } from "next/server";
import { prisma } from "./db";
import { getSessionTokenFromRequest, verifySessionToken } from "./auth-session";

export async function getCurrentUser(req: NextRequest) {
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const userId = await verifySessionToken(token);
  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
  });
}
