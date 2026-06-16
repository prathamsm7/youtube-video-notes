import { NextRequest, NextResponse } from "next/server";
import { MessageRole, VideoStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import {
  getChatForUser,
  getRecentMessages,
  saveMessage,
  toApiRole,
} from "@/lib/chats";
import { setVideoSummary } from "@/lib/videos";

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

  const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL;
  if (!PYTHON_BACKEND_URL) {
    return NextResponse.json({ detail: "PYTHON_BACKEND_URL not configured" }, { status: 500 });
  }

  const history = await getRecentMessages(chatId, 6);
  await saveMessage(chatId, MessageRole.USER, content.trim());

  const chatHistory = history.map((m) => ({
    role: toApiRole(m.role),
    content: m.content,
  }));

  const pythonRes = await fetch(`${PYTHON_BACKEND_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: content.trim(),
      video_id: chat.video.youtubeId,
      chat_history: chatHistory,
      cached_summary: chat.video.summary ?? null,
    }),
  });

  if (!pythonRes.ok || !pythonRes.body) {
    return NextResponse.json({ detail: "AI Backend error" }, { status: 502 });
  }

  const summaryGenerated = pythonRes.headers.get("X-Summary-Generated") === "true";

  const reader = pythonRes.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let answer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          answer += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        if (answer.trim()) {
          await saveMessage(chatId, MessageRole.ASSISTANT, answer);
          if (summaryGenerated) {
            await setVideoSummary(chat.video.id, answer);
          }
        }
      } catch (error) {
        console.error("Ask stream error:", error);
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
