import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ connected: false }, { status: 401 });
    }

    const profile = await prisma.notionProfile.findUnique({
      where: { userId: user.id },
    });

    if (profile) {
      return NextResponse.json({
        connected: true,
        workspace_name: profile.workspaceName,
      });
    }

    return NextResponse.json({ connected: false });
  } catch (error) {
    console.error("Notion status error:", error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}
