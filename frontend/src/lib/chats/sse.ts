import { sseComment, sseEvent, STREAM_HEADERS } from "@/lib/core";

export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      ...STREAM_HEADERS,
    },
  });
}

type QueryStreamEvent =
  | { kind: "status"; phase: string; total_chunks?: number }
  | { kind: "token"; content: string }
  | { kind: "meta"; payload: { summary_generated: boolean } };

export function mapQueryEventToSse(
  event: QueryStreamEvent,
): { payload: Record<string, unknown>; token?: string } | null {
  if (event.kind === "status") {
    return {
      payload: {
        type: "status",
        phase: event.phase,
        ...(event.total_chunks !== undefined ? { total_chunks: event.total_chunks } : {}),
      },
    };
  }

  if (event.kind === "token") {
    return {
      payload: { type: "token", content: event.content },
      token: event.content,
    };
  }

  return null;
}

export function createSseAnswerStream(
  run: (
    send: (data: Record<string, unknown>) => void,
  ) => Promise<{ answer: string; summaryGenerated: boolean }>,
  onComplete: (result: { answer: string; summaryGenerated: boolean }) => Promise<void>,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      try {
        controller.enqueue(encoder.encode(sseComment("open")));
        const result = await run(send);
        send({ type: "done" });
        controller.close();
        await onComplete(result);
      } catch (error) {
        console.error("[chats] answer stream error:", error);
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Failed to generate response",
        });
        controller.close();
      }
    },
  });
}
