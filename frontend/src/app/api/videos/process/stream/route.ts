import { NextRequest } from "next/server";
import { VideoStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { createChatWithWelcome } from "@/lib/chats";
import { sseComment, sseEvent, streamIngestEvents, STREAM_HEADERS } from "@/lib/rag";
import { extractYoutubeId, fetchYoutubeTitle } from "@/lib/youtube";
import {
  ensureVideo,
  setVideoFailed,
  setVideoProcessing,
  setVideoReady,
} from "@/lib/videos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handleIngestComplete(
  videoDbId: string,
  userId: number,
  title: string,
  totalChunks: number,
): Promise<string> {
  await setVideoReady(videoDbId, totalChunks);
  const chat = await createChatWithWelcome(userId, videoDbId, title);
  return chat.id;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return new Response(JSON.stringify({ detail: "Unauthorized" }), {
      status: 401,
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
        ...STREAM_HEADERS,
      },
    });
  }

  if (video.status === VideoStatus.PROCESSING) {
    const stuckMs = Date.now() - video.updatedAt.getTime();
    if (stuckMs < 120_000) {
      return new Response(JSON.stringify({ detail: "Video is already being processed" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let chatId: string | null = null;

      try {
        controller.enqueue(encoder.encode(sseComment("open")));
        controller.enqueue(
          encoder.encode(sseEvent({ type: "started", video_id: youtubeId, title })),
        );

        await setVideoProcessing(video.id);

        for await (const event of streamIngestEvents(youtubeId)) {
          if (event.type === "complete" && !chatId) {
            chatId = await handleIngestComplete(
              video.id,
              user.id,
              title,
              event.total_chunks,
            );
            controller.enqueue(
              encoder.encode(sseEvent({ ...event, chatId })),
            );
            continue;
          }

          if (event.type === "error") {
            await setVideoFailed(video.id, event.error);
          }

          controller.enqueue(encoder.encode(sseEvent(event)));
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
      ...STREAM_HEADERS,
    },
  });
}
