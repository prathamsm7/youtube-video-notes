import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getChatMetadataForUser } from "@/lib/chats";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const chat = await getChatMetadataForUser(id, user.id);

  if (!chat) {
    return NextResponse.json({ detail: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: chat.id,
    title: chat.title || chat.video.title,
    updatedAt: chat.updatedAt,
    video: {
      id: chat.video.id,
      youtubeId: chat.video.youtubeId,
      title: chat.video.title,
      status: chat.video.status,
    },
  });
}
