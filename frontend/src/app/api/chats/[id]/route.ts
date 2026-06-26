import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getChatForUser, serializeChatDetail } from "@/lib/chats";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { id: chatId } = await params;
  const chat = await getChatForUser(chatId, user.id);

  if (!chat) {
    return NextResponse.json({ detail: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json(serializeChatDetail(chat));
}
