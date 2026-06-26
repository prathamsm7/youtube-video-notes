import { MessageRole } from "@prisma/client";
import { after } from "next/server";
import { setDocumentSummary, streamDocumentQuery } from "@/lib/sources/document";
import { getRecentMessages, saveMessage, toApiRole } from "./db";
import { createSseAnswerStream, mapQueryEventToSse } from "./sse";

type DocumentAnswerParams = {
  userId: number;
  chatId: string;
  documentId: string;
  cachedSummary: string | null;
  question: string;
};

export function createDocumentAnswerStream(params: DocumentAnswerParams) {
  const { userId, chatId, documentId, cachedSummary, question } = params;

  return createSseAnswerStream(
    async (send) => {
      const [history] = await Promise.all([
        getRecentMessages(chatId, 6),
        saveMessage(chatId, MessageRole.USER, question),
      ]);

      const chatHistory = history.map((message) => ({
        role: toApiRole(message.role),
        content: message.content,
      }));

      send({ type: "started", question });

      let answer = "";
      let summaryGenerated = false;

      for await (const event of streamDocumentQuery(
        documentId,
        question,
        chatHistory,
        cachedSummary,
        { userId, chatId },
      )) {
        if (event.kind === "meta") {
          summaryGenerated = event.payload.summary_generated;
          continue;
        }

        const mapped = mapQueryEventToSse(event);
        if (!mapped) continue;

        if (mapped.token) {
          answer += mapped.token;
        }
        send(mapped.payload);
      }

      return { answer, summaryGenerated };
    },
    async ({ answer, summaryGenerated }) => {
      after(async () => {
        try {
          if (!answer.trim()) return;
          await saveMessage(chatId, MessageRole.ASSISTANT, answer);
          if (summaryGenerated) {
            await setDocumentSummary(documentId, answer);
          }
        } catch (error) {
          console.error("[chats/document] failed to save assistant message:", error);
        }
      });
    },
  );
}
