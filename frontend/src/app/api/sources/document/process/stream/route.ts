import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createChatWithWelcome } from "@/lib/chats";
import { sseComment, sseEvent, STREAM_HEADERS } from "@/lib/core";
import {
  createDocument,
  setDocumentFailed,
  setDocumentProcessing,
  setDocumentReady,
  streamDocumentIngest,
} from "@/lib/sources/document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

async function handleIngestComplete(
  documentDbId: string,
  userId: number,
  fileName: string,
  totalChunks: number,
): Promise<string> {
  await setDocumentReady(documentDbId, totalChunks);
  const chat = await createChatWithWelcome({
    userId,
    title: fileName,
    source: { kind: "document", documentId: documentDbId },
  });
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

  if (!process.env.UNSTRUCTURED_API_KEY) {
    return new Response(JSON.stringify({ detail: "UNSTRUCTURED_API_KEY is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ detail: "OPENAI_API_KEY is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ detail: "PDF file is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return new Response(JSON.stringify({ detail: "Only PDF files are supported" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (file.size > MAX_FILE_BYTES) {
    return new Response(JSON.stringify({ detail: "PDF must be 50MB or smaller" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fileData = new Uint8Array(await file.arrayBuffer());
  const document = await createDocument(file.name);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let chatId: string | null = null;

      try {
        controller.enqueue(encoder.encode(sseComment("open")));
        controller.enqueue(
          encoder.encode(
            sseEvent({
              type: "started",
              document_id: document.id,
              file_name: file.name,
            }),
          ),
        );

        await setDocumentProcessing(document.id);

        for await (const event of streamDocumentIngest(
          document.id,
          file.name,
          fileData,
        )) {
          if (event.type === "complete" && !chatId) {
            chatId = await handleIngestComplete(
              document.id,
              user.id,
              file.name,
              event.total_chunks,
            );
            controller.enqueue(
              encoder.encode(
                sseEvent({
                  ...event,
                  file_name: file.name,
                  chatId,
                }),
              ),
            );
            continue;
          }

          if (event.type === "error") {
            await setDocumentFailed(document.id, event.error);
          }

          controller.enqueue(encoder.encode(sseEvent(event)));
        }
      } catch (error) {
        console.error("[document/ingest] stream error:", error);
        await setDocumentFailed(document.id, "Processing failed");
        controller.enqueue(
          encoder.encode(
            sseEvent({
              type: "error",
              document_id: document.id,
              error: "Processing failed. Please try again.",
            }),
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
