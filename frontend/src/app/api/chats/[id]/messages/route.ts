import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { MessageRole, VideoStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import {
  getChatForUser,
  getChatMessagesForUser,
  getRecentMessages,
  saveMessage,
  toApiRole,
} from "@/lib/chats";
import { STREAM_HEADERS, sseComment, sseEvent, streamQueryResponse } from "@/lib/rag";
import { setVideoSummary } from "@/lib/videos";

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
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role.toLowerCase(),
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}

async function saveAssistantMessage(
  chatId: string,
  videoDbId: string,
  answer: string,
  summaryGenerated: boolean,
) {
  if (!answer.trim()) {
    return;
  }
  await saveMessage(chatId, MessageRole.ASSISTANT, answer);
  if (summaryGenerated) {
    await setVideoSummary(videoDbId, answer);
  }
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

  if (chat.video.status !== VideoStatus.READY) {
    return NextResponse.json(
      { detail: "Video is not ready for chat yet" },
      { status: 400 },
    );
  }

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ detail: "Message cannot be empty" }, { status: 400 });
  }

  const question = content.trim();
  const videoId = chat.video.youtubeId;
  const videoDbId = chat.video.id;
  const cachedSummary = chat.video.summary ?? null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      let answer = "";
      let summaryGenerated = false;

      try {
        controller.enqueue(encoder.encode(sseComment("open")));

        const [history] = await Promise.all([
          getRecentMessages(chatId, 6),
          saveMessage(chatId, MessageRole.USER, question),
        ]);

        const chatHistory = history.map((m) => ({
          role: toApiRole(m.role),
          content: m.content,
        }));

        send({ type: "started", question });

        for await (const event of streamQueryResponse(
          videoId,
          question,
          chatHistory,
          cachedSummary,
          { userId: user.id, chatId },
        )) {
          if (event.kind === "status") {
            send({
              type: "status",
              phase: event.phase,
              ...(event.total_chunks !== undefined
                ? { total_chunks: event.total_chunks }
                : {}),
            });
          } else if (event.kind === "token") {
            answer += event.content;
            send({ type: "token", content: event.content });
          } else if (event.kind === "meta") {
            summaryGenerated = event.payload.summary_generated;
          }
        }

        send({ type: "done" });
        controller.close();

        after(async () => {
          try {
            await saveAssistantMessage(chatId, videoDbId, answer, summaryGenerated);
          } catch (error) {
            console.error("Failed to save assistant message:", error);
          }
        });
      } catch (error) {
        console.error("Ask stream error:", error);
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Failed to generate response",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      ...STREAM_HEADERS,
    },
  });
}
