import { NextRequest, NextResponse } from "next/server";
import { DocumentStatus, VideoStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import {
  createDocumentAnswerStream,
  createVideoAnswerStream,
  getChatForUser,
  getChatMessagesForUser,
  serializeMessage,
  sseResponse,
} from "@/lib/chats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { id: chatId } = await params;
  const messages = await getChatMessagesForUser(chatId, user.id);

  if (!messages) {
    return NextResponse.json({ detail: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({
    messages: messages.map(serializeMessage),
  });
}

export async function POST(
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

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ detail: "Message cannot be empty" }, { status: 400 });
  }

  const question = content.trim();

  // --- Document chat ---
  if (chat.documentId && chat.document) {
    if (chat.document.status !== DocumentStatus.READY) {
      return NextResponse.json(
        { detail: "Document is not ready for chat yet" },
        { status: 400 },
      );
    }

    const stream = createDocumentAnswerStream({
      userId: user.id,
      chatId,
      documentId: chat.document.id,
      cachedSummary: chat.document.summary,
      question,
    });

    return sseResponse(stream);
  }

  // --- Video chat ---
  if (chat.videoId && chat.video) {
    if (chat.video.status !== VideoStatus.READY) {
      return NextResponse.json(
        { detail: "Video is not ready for chat yet" },
        { status: 400 },
      );
    }

    const stream = createVideoAnswerStream({
      userId: user.id,
      chatId,
      videoDbId: chat.video.id,
      youtubeId: chat.video.youtubeId,
      cachedSummary: chat.video.summary,
      question,
    });

    return sseResponse(stream);
  }

  return NextResponse.json({ detail: "Chat has no linked source" }, { status: 400 });
}
