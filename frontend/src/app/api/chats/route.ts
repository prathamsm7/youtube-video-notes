import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listUserChats, serializeChatListItem } from "@/lib/chats";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const chats = await listUserChats(user.id);

  return NextResponse.json({
    chats: chats.map(serializeChatListItem),
  });
}
