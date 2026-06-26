export type ChatStreamEvent =
  | { type: "started" }
  | { type: "status"; phase: string; total_chunks?: number }
  | { type: "token"; content: string }
  | { type: "error"; error: string };

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;

      const payload = JSON.parse(dataLine.slice(6)) as {
        type?: string;
        phase?: string;
        total_chunks?: number;
        content?: string;
        error?: string;
      };

      if (payload.type === "started") {
        yield { type: "started" };
      } else if (payload.type === "status" && payload.phase) {
        yield {
          type: "status",
          phase: payload.phase,
          total_chunks: payload.total_chunks,
        };
      } else if (payload.type === "token" && payload.content) {
        yield { type: "token", content: payload.content };
      } else if (payload.type === "error") {
        yield {
          type: "error",
          error: payload.error || "Failed to generate response",
        };
      }
    }
  }
}
