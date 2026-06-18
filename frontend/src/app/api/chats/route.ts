import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listUserChats } from "@/lib/chats";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const chats = await listUserChats(user.id);
  return NextResponse.json({
    chats: chats.map((chat) => ({
      id: chat.id,
      title: chat.title || chat.video.title,
      videoTitle: chat.video.title,
      youtubeId: chat.video.youtubeId,
      videoStatus: chat.video.status,
      updatedAt: chat.updatedAt,
    })),
  });
}
