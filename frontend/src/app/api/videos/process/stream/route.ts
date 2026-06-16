import { NextRequest } from "next/server";
import { VideoStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { createChatWithWelcome } from "@/lib/chats";
import { extractYoutubeId, fetchYoutubeTitle } from "@/lib/youtube";
import {
  ensureVideo,
  setVideoFailed,
  setVideoProcessing,
  setVideoReady,
} from "@/lib/videos";

function sseEvent(data: Record<string, unknown>) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function parseSseData(line: string): Record<string, unknown> | null {
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return new Response(JSON.stringify({ detail: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL;
  if (!PYTHON_BACKEND_URL) {
    return new Response(JSON.stringify({ detail: "PYTHON_BACKEND_URL not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const youtubeUrl = body.youtube_url as string;
  const youtubeId = extractYoutubeId(youtubeUrl);

  if (!youtubeId) {
    return new Response(JSON.stringify({ detail: "Invalid YouTube URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const title = await fetchYoutubeTitle(youtubeId);
  const video = await ensureVideo(youtubeId, youtubeUrl, title);

  if (video.status === VideoStatus.READY) {
    const chat = await createChatWithWelcome(user.id, video.id, title);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            sseEvent({
              type: "complete",
              video_id: youtubeId,
              title,
              chatId: chat.id,
              message: "Already processed",
            }),
          ),
        );
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  if (video.status === VideoStatus.PROCESSING) {
    return new Response(JSON.stringify({ detail: "Video is already being processed" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  await setVideoProcessing(video.id);

  const pythonRes = await fetch(`${PYTHON_BACKEND_URL}/process_video/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ youtube_url: youtubeUrl }),
  });

  if (!pythonRes.ok || !pythonRes.body) {
    await setVideoFailed(video.id, "AI backend failed to start processing");
    return new Response(JSON.stringify({ detail: "AI Backend error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reader = pythonRes.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let buffer = "";
      let chatId: string | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;

            const payload = parseSseData(line);
            if (!payload) continue;

            if (payload.type === "complete") {
              const totalChunks = (payload.total_chunks as number) || 0;
              await setVideoReady(video.id, totalChunks);
              const chat = await createChatWithWelcome(user.id, video.id, title);
              chatId = chat.id;
              payload.chatId = chatId;
            }

            if (payload.type === "error") {
              await setVideoFailed(
                video.id,
                (payload.error as string) || "Processing failed",
              );
            }

            controller.enqueue(encoder.encode(sseEvent(payload)));
          }
        }

        if (!chatId) {
          await setVideoReady(video.id, 0);
          const chat = await createChatWithWelcome(user.id, video.id, title);
          controller.enqueue(
            encoder.encode(
              sseEvent({
                type: "complete",
                video_id: youtubeId,
                title,
                chatId: chat.id,
              }),
            ),
          );
        }
      } catch (error) {
        console.error("Process stream error:", error);
        await setVideoFailed(video.id, "Processing failed");
        controller.enqueue(
          encoder.encode(
            sseEvent({ type: "error", error: "Processing failed. Please try again." }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
